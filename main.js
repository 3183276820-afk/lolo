const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL, fileURLToPath } = require('url');

const CH = require('./src/shared/ipcChannels');
const DEFAULT_CONFIG = require('./config/default-config.json');
const I18N = require('./src/shared/i18n');

// 界面语言：面板显式选择 > 跟随系统 > 中文兜底。
// 注意：这里用独立的 langPref 变量而不是直接读 config —— config 是 let 声明的，
// 在声明前用 typeof 探测会触发 TDZ 的 ReferenceError。
let langPref = 'auto';
let currentLang = I18N.resolveLang('auto', app.getLocale());
function refreshLang() {
  currentLang = I18N.resolveLang(langPref, app.getLocale());
  return currentLang;
}
function t(key) { return I18N.t(currentLang, key); }


// 允许桌宠窗口在无用户手势时播放提醒音效
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 出错时弹窗，避免静默退出让用户看不到原因
function showError(title, err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  try { dialog.showErrorBox(title, msg); } catch (e) { console.error(title, msg); }
}
process.on('uncaughtException', (e) => showError(t('err.startupTitle'), e));
process.on('unhandledRejection', (e) => showError(t('err.runtimeTitle'), e));
app.on('render-process-gone', (ev, win, det) => {
  const r = (det && det.reason) || 'unknown';
  slog('render-process-gone:', r);
  if (r !== 'clean-exit') showError(t('err.windowCrash'), r);
});

const userData = app.getPath('userData');
const CONFIG_PATH = path.join(userData, 'config.json');
const VIDEOS_DIR = path.join(__dirname, 'assets/videos');
const USER_VIDEOS_DIR = path.join(userData, 'videos');
const ICON_PATH = path.join(__dirname, 'assets/icon/tray.png');

// 启动诊断日志：只要进程启动就会写入，便于排查“双击无反应”
const STARTUP_LOG = path.join(userData, 'startup.log');
try { fs.mkdirSync(path.dirname(STARTUP_LOG), { recursive: true }); } catch (e) {}
function slog(...a) {
  try { fs.appendFileSync(STARTUP_LOG, `[${new Date().toISOString()}] ` + a.map(String).join(' ') + '\n'); } catch (e) {}
}
slog('=== lolo 进程已启动, 版本', app.getVersion());

// 单实例 + 自动接管：用本机 TCP 端口当互斥锁，替代 requestSingleInstanceLock。
// 原锁的缺陷是“重复实例只聚焦旧窗口、自己退出”——导致新编译的 exe 永远顶不上旧进程。
// 现改为：新实例发现已有实例时，通知旧实例退出，自己接管 → 永远运行最新双击的 exe，
// 不再需要手动 taskkill 旧进程。
const net = require('net');
const INSTANCE_PORT = 18731;
let instanceServer = null;
let instanceReady = Promise.resolve(true);

function acquireInstance() {
  return new Promise((resolve) => {
    let attempt = 0;
    const tryListen = () => {
      const srv = net.createServer((sock) => {
        // 收到新实例的接管请求 → 旧实例主动退出，让新实例接管
        sock.once('data', () => { sock.end(); app.quit(); });
      });
      srv.on('error', (err) => {
        srv.close();
        if (err.code === 'EADDRINUSE') {
          // 端口被占用 = 旧实例在跑：连接并请它退出，等待端口释放后重试
          const c = net.connect(INSTANCE_PORT, '127.0.0.1', () => c.write('REPLACE\n'));
          c.on('error', () => {});
          if (attempt < 25) { attempt++; setTimeout(tryListen, 400); }
          else { slog('多次重试仍未获取实例锁，直接启动（可能多开）'); resolve(true); }
        } else {
          slog('实例锁异常:', err.message); resolve(true);
        }
      });
      srv.listen(INSTANCE_PORT, '127.0.0.1', () => {
        instanceServer = srv;
        resolve(true);
      });
    };
    tryListen();
  });
}
instanceReady = acquireInstance();

// 视频解析：优先用户目录（打包后可热更新），回退到安装包内置素材
// 注意：必须用 pathToFileURL 生成标准的 file:///C:/... 形式，
// 直接拼 'file://' + 'C:/...' 会把 C: 当成主机名，导致资源加载失败、桌宠整块透明
function videoAbs(file) {
  if (!file) return '';
  const inUser = path.join(USER_VIDEOS_DIR, file);
  const p = fs.existsSync(inUser) ? inUser : path.join(VIDEOS_DIR, file);
  if (!fs.existsSync(p)) {
    slog('警告: 素材文件不存在 ->', file);
    return '';
  }
  return pathToFileURL(p).href;
}

// 给桌宠窗口用的配置：把各状态的视频名解析为绝对 file:// 路径
function configForPet(cfg) {
  const out = JSON.parse(JSON.stringify(cfg));
  if (out.states) {
    Object.keys(out.states).forEach((k) => {
      if (out.states[k]) out.states[k].video = videoAbs(out.states[k].video);
    });
  }
  // 食物图标同样解析为绝对 file:// 路径，供桌宠端直接 <img src>
  if (out.foods && Array.isArray(out.foods)) {
    out.foods.forEach((f) => { if (f && f.icon) f.icon = videoAbs(f.icon); });
  }
  return out;
}

// 渲染端强制重播 APNG 用：读取视频文件字节返回给渲染进程，
// 由渲染端生成唯一 blob: URL 重新赋值（file:// 协议下不能靠 ?query 制造新 URL，
// 否则 <img> 的 load 事件不触发、动画整段消失）。返回 Buffer（invoke 会序列化为 Uint8Array）。
ipcMain.handle('pet:read-asset', (e, fileUrl) => {
  try {
    const p = (fileUrl && fileUrl.startsWith('file://')) ? fileURLToPath(fileUrl) : (fileUrl || '');
    if (!fs.existsSync(p)) { slog('read-asset 文件不存在:', p); return null; }
    return fs.readFileSync(p);
  } catch (err) {
    slog('read-asset 失败:', String(err && err.message));
    return null;
  }
});

// 1x1 透明 PNG，作为托盘占位图标（如后续有图标替换此文件即可）
const BLANK_ICON = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let config = null;
let petWindow = null;
let panelWindow = null;
let tray = null;

function mergeConfig(def, cur) {
  const out = JSON.parse(JSON.stringify(def));
  if (!cur || typeof cur !== 'object') return out;
  ['size', 'idle', 'states', 'focus', 'water', 'sound', 'reminderBehavior'].forEach((k) => {
    if (cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k])) {
      out[k] = Object.assign(out[k] || {}, cur[k]);
    }
  });
  if (Array.isArray(cur.clickResponses)) out.clickResponses = cur.clickResponses;
  if (Array.isArray(cur.idleMessages)) out.idleMessages = cur.idleMessages;
  if (Array.isArray(cur.schedules)) out.schedules = cur.schedules;
  if (Array.isArray(cur.foods)) out.foods = cur.foods;
  if (typeof cur.version === 'number') out.version = cur.version;
  if (typeof cur.autoStart === 'boolean') out.autoStart = cur.autoStart;
  return out;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return mergeConfig(DEFAULT_CONFIG, raw);
    }
  } catch (e) {
    console.error('读取配置失败，使用默认配置:', e);
  }
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

// 语言生效全流程：读偏好 → 解析语言 → 翻译内置内容（保护用户自定义）→ 重建托盘 → 广播给界面
function applyLanguage() {
  langPref = (config && config.language) || 'auto';
  refreshLang();
  if (config) { try { I18N.relocalizeContent(config, currentLang); } catch (e) {} }
  refreshTrayLabels();
}

function saveConfig(cfg) {
  config = cfg;
  // 语言偏好随配置落盘，保存后立即切换整套界面文案
  applyLanguage();
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ---------- 开机自启 ----------
// 在「启动」文件夹增删 lolo 快捷方式。
//
// 【为什么不再用 PowerShell】
// 旧实现用 powershell.exe -EncodedCommand 调 WScript.Shell 生成 .lnk。但在不少机器上
// powershell.exe 会被安全软件/策略按 LOLBin 拦截，导致每次都 "autostart 设置失败"。
// 现改为 Electron 原生 shell.writeShortcutLink（内部直接调 Windows Shell API，不启任何外部进程），
// 移除快捷方式则直接用 fs，彻底无外部依赖。
//
// 【便携版路径陷阱】
// portable 版运行时 Electron 会把 app 解压到临时目录再执行，此时 process.execPath 指向的是
// 临时副本（每次解压目录都可能不同），开机自启指向它会失效。Electron 官方为此提供了
// PORTABLE_EXECUTABLE_FILE，指向用户实际双击的那个 exe，必须优先使用。
function selfExePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function getStartupLnkPath() {
  const startupDir = path.join(
    process.env.APPDATA || '',
    'Microsoft\\Windows\\Start Menu\\Programs\\Startup'
  );
  return path.join(startupDir, 'lolo 桌宠.lnk');
}

function applyAutoStart(enabled) {
  // macOS：用系统登录项 API（Windows 的 .lnk 快捷方式在 macOS 无效）
  if (process.platform === 'darwin') {
    try { app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath }); } catch (e) {}
    return;
  }
  const lnk = getStartupLnkPath();
  try {
    if (!enabled) {
      if (fs.existsSync(lnk)) fs.rmSync(lnk, { force: true });
      slog('autostart: 已关闭(启动文件夹快捷方式已移除)');
      return;
    }

    const exe = selfExePath();
    fs.mkdirSync(path.dirname(lnk), { recursive: true });
    // 图标直接取自 exe 自身（构建时已内嵌 lolo 头像），
    // 避免 resources/app 被 asar 打包后图标文件路径失效。
    const opts = {
      target: exe,
      cwd: path.dirname(exe),
      description: 'lolo 桌面宠物',
      icon: exe,
      iconIndex: 0
    };

    // 注意 operation 语义：'create' 遇到已存在会中止，'replace' 遇到不存在会失败。
    // 两者配合才能实现幂等写入（首次创建 / 后续刷新路径）。
    let ok = false;
    try { ok = shell.writeShortcutLink(lnk, 'create', opts); } catch (e) { /* 落到 replace 重试 */ }
    if (!ok) {
      try { ok = shell.writeShortcutLink(lnk, 'replace', opts); } catch (e) { /* 下面统一报错 */ }
    }
    if (!ok) { slog('autostart: 创建快捷方式失败(create/replace 均返回 false):', lnk); return; }

    // 读回校验，确认落盘的 target 与预期一致（便携版曾出现指向临时目录的问题）
    let target = '(读取失败)';
    try {
      target = (shell.readShortcutLink(lnk) || {}).target || '(空)';
    } catch (re) {
      target = '(读取异常:' + ((re && re.message) || re) + ')';
    }
    slog('autostart: 已开启 ->', lnk, '| 目标:', target, '| 期望:', exe, '| 一致:', String(target === exe));
  } catch (e) {
    slog('autostart 设置失败:', (e && (e.stack || e.message)) || String(e));
  }
}

// ---------- 提醒引擎 ----------
// 番茄钟状态：idle | running | paused
let focus = { phase: 'idle', remainingSec: 0, endAt: 0, curDurationMin: 0 };
let waterNextAt = 0;
let engineTimer = null;

function focusSnapshot() {
  return {
    phase: focus.phase,
    remainingSec: focus.remainingSec,
    durationMin: focus.curDurationMin || (config.focus && config.focus.durationMin) || 25
  };
}

function broadcastFocusState() {
  const snap = focusSnapshot();
  if (petWindow) petWindow.webContents.send(CH.FOCUS_STATE, snap);
  sendPanel(CH.FOCUS_STATE, snap);
}

function focusStart(minutes) {
  const min = minutes || (config.focus && config.focus.durationMin) || 25;
  if (focus.phase === 'running') return;
  if (focus.phase !== 'paused') {
    focus.curDurationMin = min;
    focus.remainingSec = min * 60;
  }
  focus.phase = 'running';
  focus.endAt = Date.now() + focus.remainingSec * 1000;
  broadcastFocusState();
}

function focusPause() {
  if (focus.phase !== 'running') return;
  focus.remainingSec = Math.max(0, Math.round((focus.endAt - Date.now()) / 1000));
  if ((config.focus && config.focus.strictMode)) {
    // 严格模式：暂停计时直接终止本轮专注
    focus.phase = 'idle';
    focus.remainingSec = ((config.focus && config.focus.durationMin) || 25) * 60;
    triggerReminder('focus', t('notify.focusAborted.title'), t('notify.focusAborted.body'));
  } else {
    focus.phase = 'paused';
  }
  broadcastFocusState();
}

function focusStop() {
  focus.phase = 'idle';
  focus.remainingSec = ((config.focus && config.focus.durationMin) || 25) * 60;
  broadcastFocusState();
}

function focusToggle() {
  if (focus.phase === 'running') focusPause();
  else focusStart();
}

function triggerReminder(type, title, text) {
  // 喝水提醒固定播「喝水」动画（lolo 举杯喝水），其余提醒用面板配置的动作。
  // 日程提醒标题/内容里提到"喝水/喝"时也播喝水动画，表现更贴题
  let action;
  const wantsDrink = type === 'water' ||
    (type === 'schedule' && /喝水|喝一杯|补补水|hydration/i.test((title || '') + (text || '')));
  if (wantsDrink && config.states && config.states.drink && config.states.drink.video) {
    action = 'drink';
  }
  // 桌宠动画 + 气泡（渲染端按 reminderBehavior 决定具体表现）
  if (petWindow) {
    petWindow.webContents.send(CH.REMINDER_EVENT, { type, title, text, action });
  }
  // 番茄钟状态变化后同步面板
  broadcastFocusState();
}

function pad2(n) { return String(n).padStart(2, '0'); }

function checkSchedules(now) {
  const list = (config.schedules || []);
  let dirty = false;
  const dayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const dow = now.getDay(); // 0 周日
  const nowMin = now.getHours() * 60 + now.getMinutes();

  list.forEach((s) => {
    if (!s || s.enabled === false || !s.time) return;
    const [hh, mm] = String(s.time).split(':').map((x) => parseInt(x, 10));
    if (isNaN(hh) || isNaN(mm)) return;
    const lead = parseInt(s.leadMin, 10) || 0;
    const triggerMin = hh * 60 + mm - lead;
    if (nowMin !== triggerMin) return; // 每分钟精度：恰好命中触发分钟

    let shouldFire = false;
    if (s.repeat === 'daily') shouldFire = true;
    else if (s.repeat === 'weekdays') shouldFire = (dow >= 1 && dow <= 5);
    else { // once
      shouldFire = !s.fired;
    }
    if (!shouldFire) return;

    // 同一天同一条只触发一次
    if (s.lastFiredDate === dayKey) return;
    s.lastFiredDate = dayKey;
    if (s.repeat === 'once') { s.fired = true; }
    dirty = true;
    const shownTitle = s.title || t('notify.schedule.defaultTitle');
    // 中英文的标点习惯不同：中文用全角括号，英文用半角，按当前语言拼接
    const bodyText = currentLang === 'en-US'
      ? `${t('notify.schedule.body')}${shownTitle} (${pad2(hh)}:${pad2(mm)})`
      : `${t('notify.schedule.body')}${shownTitle}（${pad2(hh)}:${pad2(mm)}）`;
    triggerReminder('schedule', s.title || t('notify.schedule.title'), bodyText);
  });

  if (dirty) saveConfig(config);
}

function startEngine() {
  if (engineTimer) clearInterval(engineTimer);
  focusStop();

  engineTimer = setInterval(() => {
    const now = Date.now();

    // 番茄钟
    if (focus.phase === 'running') {
      focus.remainingSec = Math.max(0, Math.round((focus.endAt - now) / 1000));
      if (focus.remainingSec <= 0) {
        triggerReminder('focus', t('notify.focusDone.title'), t('notify.focusDone.body'));
        if (config.focus && config.focus.autoRun) {
          // 一轮结束自动开启下一段计时
          focus.remainingSec = ((config.focus && config.focus.durationMin) || 25) * 60;
          focus.phase = 'running';
          focus.endAt = now + focus.remainingSec * 1000;
        } else {
          focus.phase = 'idle';
          focus.remainingSec = ((config.focus && config.focus.durationMin) || 25) * 60;
        }
        broadcastFocusState();
      } else if (focus.remainingSec % 15 === 0) {
        broadcastFocusState(); // 每 15 秒同步一次剩余时间
      }
    }

    // 喝水提醒（独立于番茄循环）
    const water = config.water || {};
    if (water.enabled) {
      if (!waterNextAt) waterNextAt = now + (water.intervalMin || 40) * 60000;
      if (now >= waterNextAt) {
        triggerReminder('water', t('notify.water.title'), t('notify.water.body'));
        waterNextAt = now + (water.intervalMin || 40) * 60000;
      }
    } else {
      waterNextAt = 0;
    }

    // 日程事项
    checkSchedules(new Date());
  }, 1000);
}

// 渲染进程诊断：把页面里的 console 输出与加载失败转发到 startup.log，
// 一旦桌宠/面板 JS 出错，日志里立刻可见，避免“空框却无线索”
function attachWebDiagnostics(win, name) {
  const wc = win.webContents;
  wc.on('console-message', (e, level, message) => {
    // level: 0 verbose,1 info,2 warning,3 error
    const lv = ['VERBOSE', 'INFO', 'WARN', 'ERROR'][level] || ('L' + level);
    slog(`[${name} console ${lv}]`, message);
  });
  wc.on('did-fail-load', (e, code, desc, url) => {
    slog(`[${name} did-fail-load]`, 'code=' + code, desc, 'url=' + url);
  });
  wc.on('did-finish-load', () => slog(`[${name}] 页面加载完成`));
}

// ---------- 窗口 ----------
function createPetWindow() {
  petWindow = new BrowserWindow({
    width: config.size.width,
    height: config.size.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    // 关键：在 Windows 上，透明窗必须显式给一个带 alpha 的 backgroundColor，
    // 否则窗口会渲染成默认灰底（即“lolo 身上的灰框”）。'#00000000' 为完全透明。
    backgroundColor: '#00000000',
    resizable: false,
    // 关键：resizable:false 在 Windows 上会把窗口最小尺寸默认锁成创建时的大小，
    // 导致程序化 setSize 只能放大、缩不回去（用户报“只能放大不能缩小”）。
    // 显式给一个很小的 min 和很大的 max，覆盖该默认锁，缩放才能双向生效。
    minWidth: 40,
    minHeight: 40,
    maxWidth: 2000,
    maxHeight: 2000,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  petWindow.loadFile(path.join(__dirname, 'src/pet/pet.html'));
  attachWebDiagnostics(petWindow, 'pet');

  // 关键修复：resizable:false 窗口在 Windows 上，构造参数里的 min/max 会被忽略，
  // 最小尺寸被系统锁成创建时的大小(240)，导致 setSize 只能放大、缩不回去。
  // 用运行时 API 显式解锁，真正写入 Windows 的 MINMAXINFO，覆盖该默认锁，缩放才能双向生效。
  try {
    petWindow.setMinimumSize(40, 40);
    petWindow.setMaximumSize(2000, 2000);
  } catch (e) {
    slog('[pet] setMin/MaxSize 不可用（非 Windows 平台？）:', e.message);
  }

  // 尺寸看门狗：resize 事件里发现实际尺寸偏离期望值就立即回弹。
  // petExpectedSize 初始为创建时配置尺寸，首次 SET_SIZE 后由 setPetSize 接管。
  petExpectedSize = [config.size.width, config.size.height];
  petWindow.on('resize', () => {
    if (petGuardBusy || !petExpectedSize || !petWindow || petWindow.isDestroyed()) return;
    try {
      const [cw, ch] = petWindow.getSize();
      if (cw !== petExpectedSize[0] || ch !== petExpectedSize[1]) {
        slog('[pet] 看门狗回弹:', cw + 'x' + ch, '->', petExpectedSize.join('x'));
        petGuardBusy = true;
        const b = petWindow.getBounds();
        petWindow.setBounds({ x: b.x, y: b.y, width: petExpectedSize[0], height: petExpectedSize[1] });
        setTimeout(() => { petGuardBusy = false; }, 150);
      }
    } catch (e) {}
  });

  // 显式展示 + 首启居中，避免透明窗口被定位到屏幕外而“看不见”
  petWindow.once('ready-to-show', () => {
    petWindow.center();
    petWindow.show();
    petWindow.focus();
    ensurePetTopmost(); // 显示后立即拉到最高置顶层
  });
  // 任何情况下窗口重新显示（最小化恢复、被程序 show 等）都重新 assert 置顶
  petWindow.on('show', ensurePetTopmost);
  // 焦点/移动/尺寸/最大化等变化后重新声明置顶，对抗其它窗口抢占 z 序
  // （例如新开一个页面并抢到前台时，Windows 可能把 lolo 临时压到下方）
  ['focus', 'blur', 'move', 'resize', 'restore', 'maximize', 'unmaximize'].forEach((ev) => {
    try { petWindow.on(ev, ensurePetTopmost); } catch (e) {}
  });
  // 兜底：周期性重申置顶（每 1s）。即便被某些“新开页面/全屏应用”临时压到，
  // 也能在 1 秒内立即浮回最上层；面板打开期间 ensurePetTopmost 会主动让位，不受影响。
  setInterval(() => {
    if (petWindow && !petWindow.isDestroyed() && petWindow.isVisible()) ensurePetTopmost();
  }, 1000);

  petWindow.webContents.once('did-finish-load', () => {
    petWindow.webContents.send(CH.CONFIG_UPDATED, configForPet(config));
    broadcastFocusState();
  });
  return petWindow;
}

function createPanelWindow() {
  const w = new BrowserWindow({
    width: 880,
    height: 720,
    frame: true,
    resizable: true,
    show: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  w.loadFile(path.join(__dirname, 'src/panel/panel.html'));
  attachWebDiagnostics(w, 'panel');
  w.on('close', (e) => {
    e.preventDefault();
    hidePanel();
  });
  // 窗口被真正销毁（app 退出 / 单实例接管竞态 / 渲染进程回收）时清空引用，
  // 避免后续 showPanel 拿到「非空但已销毁」的脏引用触发 Object has been destroyed
  w.on('closed', () => { if (panelWindow === w) panelWindow = null; });
  panelWindow = w;
  return w;
}

// 安全拿到一个有效（必要时重建）的面板窗口；返回 null 表示创建失败
function ensurePanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) return panelWindow;
  panelWindow = null; // 旧的已失效
  try { return createPanelWindow(); } catch (e) { slog('重建面板窗口失败:', e.message); return null; }
}

// 向面板广播；窗口为空或已销毁时静默跳过，绝不抛 Object has been destroyed
function sendPanel(channel, ...args) {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  try { panelWindow.webContents.send(channel, ...args); } catch (e) {}
}

// 保持 lolo 悬浮在普通窗口之上。用 'screen-saver' 置顶层（高于默认 floating），
// 避免被其它置顶窗口（任务管理器、画中画等）压住；面板打开期间例外（见 showPanel）。
function ensurePetTopmost() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) return; // 面板打开期间特意取消置顶
  try { petWindow.setAlwaysOnTop(true, 'screen-saver'); } catch (e) {}
}

function hidePanel() {
  if (!panelWindow || panelWindow.isDestroyed()) return;
  panelWindow.hide();
  // 关掉面板后，桌宠恢复常驻置顶
  ensurePetTopmost();
}

// 把面板窗口摆到不遮挡 lolo 的位置：若窗口当前与 lolo 矩形重叠，则尝试贴屏幕左右/上下边。
// 仅当用户自己没把面板挪到「不挡 lolo」的位置时才自动调整，尊重用户摆放习惯。
function positionPanelAwayFromPet() {
  if (!panelWindow || panelWindow.isDestroyed() || !petWindow || petWindow.isDestroyed()) return;
  const inter = (a, b) => (a.x < b.x + b.width && b.x < a.x + a.width &&
                           a.y < b.y + b.height && b.y < a.y + a.height);
  const pb = petWindow.getBounds();
  const ps = panelWindow.getBounds();
  if (!inter(ps, pb)) return; // 当前位置本就不挡 lolo，保持
  const area = screen.getPrimaryDisplay().workArea;
  const cy = Math.max(area.y, area.y + Math.round((area.height - ps.height) / 2));
  const cxL = Math.max(area.x, Math.min(area.x + area.width - ps.width, area.x + 8));
  const cxR = Math.max(area.x, Math.min(area.x + area.width - ps.width, area.x + area.width - ps.width - 8));
  const candidates = [
    { x: cxR, y: cy }, // 右侧贴边
    { x: cxL, y: cy }, // 左侧贴边
    { x: Math.max(area.x, area.x + Math.round((area.width - ps.width) / 2)), y: area.y + 8 }, // 顶部
    { x: Math.max(area.x, area.x + Math.round((area.width - ps.width) / 2)), y: area.y + area.height - ps.height - 8 } // 底部
  ];
  for (const c of candidates) {
    const r = { x: c.x, y: c.y, width: ps.width, height: ps.height };
    if (!inter(r, pb)) { panelWindow.setPosition(c.x, c.y); return; }
  }
  // 屏幕太小放不下无缝位置：居中（此时 lolo 大概率被盖，但已是最好结果）
}

function showPanel() {
  const win = ensurePanelWindow();
  if (!win) return;
  // 面板打开期间先把桌宠取消置顶，否则透明桌宠窗口会浮在面板之上挡住点击
  if (petWindow && !petWindow.isDestroyed()) petWindow.setAlwaysOnTop(false);
  positionPanelAwayFromPet();
  win.show();
  win.focus();
  win.webContents.send(CH.CONFIG_FOR_PANEL, config);
  win.webContents.send(CH.FOCUS_STATE, focusSnapshot());
}

function togglePanel() {
  if (!panelWindow || panelWindow.isDestroyed()) { showPanel(); return; }
  if (panelWindow.isVisible()) hidePanel();
  else showPanel();
}

function createTray() {
  try {
    if (!fs.existsSync(ICON_PATH)) {
      fs.mkdirSync(path.dirname(ICON_PATH), { recursive: true });
      fs.writeFileSync(ICON_PATH, Buffer.from(BLANK_ICON, 'base64'));
    }
    const trayIcon = nativeImage.createFromPath(ICON_PATH);
    if (process.platform === 'darwin') trayIcon.setTemplateImage(true); // 模板图：自动适配深浅色
    tray = new Tray(trayIcon);
  } catch (e) {
    console.warn('托盘图标创建失败，跳过托盘:', e);
    return;
  }
  const contextMenu = Menu.buildFromTemplate([
    { label: t('tray.openPanel'), click: () => showPanel() },
    { label: t('tray.quit'), click: () => app.exit(0) }
  ]);
  tray.setToolTip(t('tray.tooltip') + app.getVersion()); // 版本可见化：托盘悬停即可核对测试用户跑的是哪个版本
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showPanel());
}

// 语言切换后重建托盘菜单与悬停提示（菜单是构建时快照，必须重建才会变语言）
function refreshTrayLabels() {
  if (!tray || typeof tray.isDestroyed === 'function' && tray.isDestroyed()) return;
  try {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: t('tray.openPanel'), click: () => showPanel() },
      { label: t('tray.quit'), click: () => app.exit(0) }
    ]));
    tray.setToolTip(t('tray.tooltip') + app.getVersion());
  } catch (e) { /* 托盘不可用时静默跳过 */ }
}

// ---------- IPC ----------
ipcMain.on(CH.DEBUG_LOG, (e, msg) => slog('[renderer]', msg));

// 关键修复：resizable:false 窗口在 Windows 上，程序化 setSize 只能放大、缩不回去
// （构造参数 min/max 和运行时 setMinimumSize 都拦不住系统锁）。可靠做法：临时放开
// resizable 再 setSize，缩小即生效；随后恢复 resizable:false（用户仍不能拖边框改大小）。
// 尺寸看门狗：记录当前应锁定的宠物窗口尺寸。任何外力（系统 DPI 重算、拖拽边界、
// 显卡驱动、某些 Windows 版本重置 MINMAXINFO 等）把窗口改大/改小，都立即弹回。
// 这是"拖拽/走路/长按变大"的最后一道保险丝：即使 min==max 锁被系统绕过也兜得住。
let petExpectedSize = null;
let petGuardBusy = false;

function setPetSize(w, h) {
  if (!petWindow) return;
  petExpectedSize = [w, h]; // 看门狗以此为基准，偏离即回弹
  try { petWindow.setResizable(true); } catch (e) {}
  // 先放开 min/max 约束，否则上一次的 min==max 锁会把 setSize 顶回去
  try { petWindow.setMinimumSize(40, 40); } catch (e) {}
  try { petWindow.setMaximumSize(2000, 2000); } catch (e) {}
  try { petWindow.setSize(w, h, false); } catch (e) { slog('[pet] setSize 失败:', e.message); }
  try { petWindow.setResizable(false); } catch (e) {}
  // 设完后把最小/最大都钉成目标值：即便 Windows 上 resizable:false 不可靠
  // （本仓库已多次踩坑，表现为“只能放大不能缩小”），min==max 约束也能彻底锁死尺寸，
  // 鼠标/触摸长按拖拽、走路时的高频 setBounds 都再也无法把 lolo 拖大或拖小
  // （根治“拖拽 / 走路 / 长按 一直变大”，用户反馈仅这两个动作会变大）。
  try { petWindow.setMinimumSize(w, h); } catch (e) {}
  try { petWindow.setMaximumSize(w, h); } catch (e) {}
}

ipcMain.on(CH.SAVE_CONFIG, (e, newConfig) => {
  saveConfig(mergeConfig(DEFAULT_CONFIG, newConfig));
  applyAutoStart(!!config.autoStart);
  if (petWindow) petWindow.webContents.send(CH.CONFIG_UPDATED, configForPet(config));
  // 直达兜底：保存后主进程亲自重设窗口尺寸，确保「缩放/宽高」必定生效
  //（旧版只靠渲染端收到配置后再 SET_SIZE，偶发不生效 = 用户说的"有时没反应"）
  if (petWindow && config.size) {
    setPetSize(config.size.width, config.size.height);
  }
  // 专注配置变化时，重算剩余展示；运行中的计时保留
  broadcastFocusState();
});

ipcMain.on(CH.RESET_DEFAULT, () => {
  saveConfig(mergeConfig(DEFAULT_CONFIG, JSON.parse(JSON.stringify(DEFAULT_CONFIG))));
  applyAutoStart(!!config.autoStart);
  if (petWindow) petWindow.webContents.send(CH.CONFIG_UPDATED, configForPet(config));
  sendPanel(CH.CONFIG_FOR_PANEL, config);
  // 关键：恢复默认后，主进程亲自把窗口尺寸设回默认（放大的要能缩回来）
  if (petWindow && config.size) {
    setPetSize(config.size.width, config.size.height);
  }
});

ipcMain.on(CH.REQUEST_CONFIG, () => {
  sendPanel(CH.CONFIG_FOR_PANEL, config);
  sendPanel(CH.FOCUS_STATE, focusSnapshot());
});

ipcMain.on(CH.UPLOAD_ASSET, (e, payload) => {
  const { state, name, data } = payload;
  fs.mkdirSync(USER_VIDEOS_DIR, { recursive: true });
  const ext = path.extname(name) || '.mp4';
  const safeName = (state + ext).replace(/[^\w.]/g, '_');
  fs.writeFileSync(path.join(USER_VIDEOS_DIR, safeName), Buffer.from(data));
  if (!config.states[state]) config.states[state] = { video: '', label: state };
  config.states[state].video = safeName;
  saveConfig(config);
  if (petWindow) petWindow.webContents.send(CH.CONFIG_UPDATED, configForPet(config));
  sendPanel(CH.CONFIG_FOR_PANEL, config);
});

// 食物图标上传：面板新增/更换某食物的图标，保存到用户目录并以文件名回传
ipcMain.handle(CH.UPLOAD_FOOD_ICON, async (e, payload) => {
  const { foodId, name, data } = payload || {};
  fs.mkdirSync(USER_VIDEOS_DIR, { recursive: true });
  const ext = path.extname(name) || '.png';
  const safeBase = 'food_' + (foodId || 'x') + '_' + Date.now().toString(36);
  const safeName = safeBase + ext.replace(/[^\.\w]/g, '');
  fs.writeFileSync(path.join(USER_VIDEOS_DIR, safeName), Buffer.from(data));
  if (!config.foods) config.foods = [];
  const f = config.foods.find((x) => x.id === foodId);
  if (f) f.icon = safeName;
  saveConfig(config);
  if (petWindow) petWindow.webContents.send(CH.CONFIG_UPDATED, configForPet(config));
  // 注意：这里不再 sendPanel(CONFIG_FOR_PANEL)。否则会用“主进程 config”整体覆盖面板
  // working——而新增食物还没点“保存”进 config 时，config.foods 里没有它，覆盖后整条
  // 新食物（含刚传的图标）会被一起抹掉。面板侧在回调里已 api.send(SAVE_CONFIG, working)
  // 持久化并触发同步，无需此处再推。
  return safeName;
});

// 通用文件选择：改用主进程 dialog.showOpenDialog，避免渲染进程动态 <input type=file>
// 在 Electron 打包后不弹文件对话框（这是经典坑，导致“上传图标/上传素材”完全没反应）
ipcMain.handle(CH.PICK_FILE, async (e, opts) => {
  const accept = (opts && opts.accept) || 'image/*';
  let filters = [{ name: t('dialog.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }];
  if (accept.indexOf('video') >= 0) {
    filters = [{ name: t('dialog.videos'), extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }];
  }
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: t('dialog.selectFile'),
      properties: ['openFile'],
      filters
    });
    if (canceled || !filePaths || !filePaths.length) return null;
    const p = filePaths[0];
    const data = fs.readFileSync(p);
    return { name: path.basename(p), data };
  } catch (err) {
    slog('[PICK_FILE] 失败:', err.message);
    return null;
  }
});

// 把一个素材文件名解析为可供 <img src> 使用的 file:// 绝对路径（面板预览用）
ipcMain.handle(CH.ASSET_URL, async (e, name) => videoAbs(name || ''));

ipcMain.on(CH.TOGGLE_PANEL, () => togglePanel());

// 专注控制：来自桌宠右键 / 面板
// 兼容两种调用：字符串('toggle') 或对象({cmd, min})，后者支持自定义时长
ipcMain.on(CH.FOCUS_CMD, (e, payload) => {
  let cmd, min;
  if (payload && typeof payload === 'object') { cmd = payload.cmd; min = payload.min; }
  else { cmd = payload; }
  if (cmd === 'toggle') focusToggle();
  else if (cmd === 'pause') focusPause();
  else if (cmd === 'start') focusStart(min);
  else if (cmd === 'stop') focusStop();
});
ipcMain.on(CH.PANEL_FOCUS_CMD, (e, payload) => {
  // 兼容字符串('start')和对象({cmd:'start', min:25})两种调用；对象形式让
  // 「开始专注」立即使用滑块当前选中的时长（无需先点保存）
  let cmd = payload, min;
  if (payload && typeof payload === 'object') { cmd = payload.cmd; min = payload.min; }
  if (cmd === 'start') focusStart(min);
  else if (cmd === 'pause') focusPause();
  else if (cmd === 'stop') focusStop();
});

// ---------- 原生右键菜单 ----------
// 用系统原生菜单替代桌宠窗口内的 HTML 菜单：原生菜单是操作系统级浮层，
// 弹出时完全不会遮住 lolo 本体（旧 HTML 菜单画在 240x240 小窗里，必然压在 lolo 身上）。
function petAction(action) {
  // 转发给渲染进程执行的动画类动作（喂食/睡觉/倒立等，需要桌宠端素材与状态机）
  if (petWindow) petWindow.webContents.send(CH.PET_MENU_CMD, action);
}

// ---------- 自建右键菜单窗口 ----------
// 说明：透明 + 无边框 + 置顶 的桌宠窗口下，Electron 原生 Menu.popup 在 Windows 上经常
// 静默不弹出（系统菜单被置顶透明层遮挡/抢不到焦点）。改为自建一个小窗口渲染菜单，
// 完全可控：z 序、位置、且不遮挡 lolo。
let menuWindow = null;
let menuPos = { x: 0, y: 0 };
let menuReady = false;
const MENU_W = 188;

function ensureMenuWindow() {
  if (menuWindow) return menuWindow;
  menuWindow = new BrowserWindow({
    width: MENU_W,
    height: 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  menuWindow.loadFile(path.join(__dirname, 'src/pet/menu.html'));
  attachWebDiagnostics(menuWindow, 'menu');
  // 失焦即关闭（点击 lolo / 桌面其它处都会让它 blur）
  menuWindow.on('blur', () => closeMenuWindow());
  menuWindow.on('closed', () => { menuWindow = null; });
  return menuWindow;
}

function closeMenuWindow(force) {
  if (menuWindow && (force || menuReady)) {
    menuReady = false;
    menuWindow.hide();
  }
}

function intersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.width <= a.x || a.y + a.h <= b.y || b.y + b.height <= a.y);
}

// 在光标处弹出；若会盖住 lolo，则移到 lolo 旁不重叠的位置；最终夹在屏幕内
function positionMenuWindow(cursorX, cursorY, h) {
  const pet = petWindow ? petWindow.getBounds() : null;
  let x = cursorX + 2;
  let y = cursorY + 2;
  if (pet && intersect({ x, y, w: MENU_W, h }, pet)) {
    const sr = screen.getPrimaryDisplay().workArea;
    const right = pet.x + pet.width + 6;
    const left = pet.x - MENU_W - 6;
    const below = pet.y + pet.height + 6;
    if (right + MENU_W <= sr.x + sr.width) x = right;
    else if (left >= sr.x) x = left;
    else if (below + h <= sr.y + sr.height) y = below;
    else y = pet.y - h - 6;
  }
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  x = Math.max(0, Math.min(x, sw - MENU_W));
  y = Math.max(0, Math.min(y, sh - h));
  menuPos = { x, y };
  menuWindow.setPosition(x, y, false);
}

function buildPetMenuItems() {
  const mins = [5, 10, 15, 25, 30, 45, 60];
  const preset = (config.focus && config.focus.durationMin) || 25;
  const items = [
    { label: t('menu.sleep'), action: 'sleep' },
    { label: t('menu.walk'), action: 'walk' },
    { label: t('menu.idleDefault'), action: 'idle-restore' },
    { label: t('menu.upsideDown'), action: 'upside_down' },
    { label: t('menu.cheer'), action: 'cheer' },
    { label: t('menu.turn'), action: 'turn' },
    { label: t('menu.feed'), action: 'feed' },
    { sep: true }
  ];
  if (focus.phase === 'running') {
    items.push({ label: t('menu.pausePomodoro'), action: 'focus-pause' });
    items.push({ label: t('menu.stopFocus'), action: 'focus-stop' });
  } else if (focus.phase === 'paused') {
    items.push({ label: t('menu.resumePomodoro'), action: 'focus-resume' });
    items.push({ label: t('menu.stopFocus'), action: 'focus-stop' });
  } else {
    // 时长选择放进子菜单，取代旧的全窗口半透明「时长选择弹层」（那层灰罩会盖住 lolo）
    items.push({
      label: t('menu.startPomodoro'),
      submenu: mins.map((m) => ({
        label: m + t('unit.minutes') + (m === preset ? t('suffix.default') : ''),
        action: 'focus-start',
        arg: m
      }))
    });
  }
  items.push({ sep: true });
  items.push({ label: t('menu.openPanel'), action: 'panel' });
  return items;
}

function performMenuAction(action, arg) {
  switch (action) {
    case 'sleep':
    case 'walk':
    case 'upside_down':
    case 'cheer':
    case 'turn':
    case 'feed':
      petAction(action);
      break;
    case 'idle-restore':
      // 恢复面板里配置的「闲置默认模式」（手动选睡觉/走走会覆盖它，用这个还原）
      petAction('idle_restore');
      break;
    case 'focus-start':
      focusStart(arg);
      break;
    case 'focus-pause':
      focusPause();
      break;
    case 'focus-stop':
      focusStop();
      break;
    case 'focus-resume':
      focusStart();
      break;
    case 'panel':
      togglePanel();
      break;
  }
}

ipcMain.handle(CH.PET_CONTEXT_MENU, (e, pos) => {
  if (!petWindow) return;
  const items = buildPetMenuItems();
  ensureMenuWindow();
  const estH = Math.min(8 + items.length * 30, 560);
  menuWindow.setSize(MENU_W, estH, false);
  positionMenuWindow((pos && typeof pos.x === 'number') ? pos.x : 0, (pos && typeof pos.y === 'number') ? pos.y : 0, estH);
  menuWindow.webContents.send(CH.MENU_ITEMS, items);
  menuWindow.show();
  menuWindow.moveTop();
  menuWindow.focus();
  // 武装 blur 关闭：避开 show()/focus() 瞬间的焦点抖动导致菜单立刻被关
  menuReady = false;
  setTimeout(() => { menuReady = true; }, 80);
});

ipcMain.on(CH.MENU_PICK, (e, payload) => {
  const { action, arg } = payload || {};
  closeMenuWindow(true);
  performMenuAction(action, arg);
});

ipcMain.on(CH.MENU_SIZE, (e, payload) => {
  if (!menuWindow || !payload) return;
  const h = Math.max(40, Math.min(payload.h || 40, 560));
  const { height: sh } = screen.getPrimaryDisplay().workAreaSize;
  let y = menuPos.y;
  if (y + h > sh) y = Math.max(0, sh - h);
  menuPos.y = y;
  menuWindow.setSize(MENU_W, h, false);
  menuWindow.setPosition(menuPos.x, y, false);
});

ipcMain.on(CH.MENU_CLOSE, () => closeMenuWindow(true));

// ---------- 独立气泡窗口 ----------
// 气泡（日常说话/提醒）画在桌宠窗口外的独立置顶小窗，悬浮在 lolo 头顶（或脚下），
// 彻底解决 240x240 小窗内气泡必然压在 lolo 身上的问题。窗口不抢焦点（showInactive）。
// 重要：窗口尺寸固定、绝不 resize —— Windows 上透明窗口 setBounds 改尺寸会触发
// 重绘 bug（新暴露区域不重绘，表现为气泡文字/背景“缺一块”）。
// 改为：大窗口 + 内容居中，尾部永远指向 lolo；透明区域不挡鼠标。
const BUBBLE_WIN_W = 460;
const BUBBLE_WIN_H = 150;
let bubbleWindow = null;
let bubblePayload = null;   // 最近一次气泡内容（用于位置翻转时重发）
let bubbleBelow = false;    // 当前气泡是否在 lolo 脚下（决定尾巴朝向）
let bubbleReady = false;    // 渲染端（bubble.js）是否已就绪，可安全收内容
let bubblePending = null;   // 渲染未就绪时缓存待下发的内容
let lastBubblePos = { x: NaN, y: NaN }; // 上次应用的气泡位置（避免无谓的重复 setBounds）

function ensureBubbleWindow() {
  if (bubbleWindow) return bubbleWindow;
  bubbleWindow = new BrowserWindow({
    width: BUBBLE_WIN_W,
    height: BUBBLE_WIN_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000', // 关键：透明窗口必须显式全透明背景，否则 DWM 合成会漏掉文字/区域（表现为“字体缺一块”）
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  bubbleWindow.loadFile(path.join(__dirname, 'src/pet/bubble.html'));
  // 鼠标穿透：窗口整体不挡点击（透明区域直接透过到桌面/其它窗口），
  // 仅气泡本体（bubble.html 里 #panel 设了 -webkit-app-region: no-drag）可点击关闭提醒。
  // 这同时消除了“气泡窗太大、上方一大片透明区会拦截鼠标”的违和感（之前让人觉得气泡飘得远）。
  try { bubbleWindow.setIgnoreMouseEvents(true, { forward: true }); } catch (e) { /* 旧版 Electron 忽略 */ }
  attachWebDiagnostics(bubbleWindow, 'bubble');
  // 渲染端就绪后再收内容：loadFile 是异步的，提前 send 会被丢弃（首次气泡内容丢失）
  bubbleWindow.webContents.on('did-finish-load', () => {
    bubbleReady = true;
    if (bubblePending) {
      bubbleWindow.webContents.send(CH.BUBBLE_CONTENT, bubblePending);
      bubblePending = null;
    }
  });
  bubbleWindow.on('closed', () => { bubbleWindow = null; bubbleReady = false; lastBubblePos = { x: NaN, y: NaN }; });
  return bubbleWindow;
}

// 计算/更新气泡窗口位置：水平中心对齐 lolo 中心；默认头顶上方，顶部放不下则脚下。
// 若“上方/脚下”发生翻转，向渲染端重发内容（翻转尾巴朝向）。
function positionBubbleWindow(force) {
  if (!bubbleWindow) return;
  if (!force && !bubbleWindow.isVisible()) return;
  const pet = petWindow ? petWindow.getBounds() : null;
  // 多显示器：以 lolo 所在屏幕的工作区为准（否则 lolo 在副屏时气泡会被钉死在主屏边缘）
  let wa;
  if (pet) {
    const disp = screen.getDisplayNearestPoint({ x: Math.round(pet.x + pet.width / 2), y: Math.round(pet.y + pet.height / 2) });
    wa = (disp && disp.workArea) ? disp.workArea : screen.getPrimaryDisplay().workArea;
  } else {
    wa = screen.getPrimaryDisplay().workArea;
  }
  const w = BUBBLE_WIN_W, h = BUBBLE_WIN_H;
  let below = false;
  let x = pet ? Math.round(pet.x + pet.width / 2 - w / 2) : wa.x + 40;
  let y = pet ? pet.y - h - 2 : wa.y + 40;      // 默认：lolo 头顶上方居中（紧贴）
  if (pet && y < wa.y + 2) { below = true; y = pet.y + pet.height + 2; } // 顶到屏幕上沿则放脚下（紧贴）
  x = Math.max(wa.x + 2, Math.min(x, wa.x + wa.width - w - 2));
  y = Math.max(wa.y + 2, Math.min(y, wa.y + wa.height - h - 2));
  // 位置没变化就不重复 setBounds（轮询兜底时避免无谓的窗口操作）
  const moved = (x !== lastBubblePos.x || y !== lastBubblePos.y);
  lastBubblePos = { x, y };
  if (moved) bubbleWindow.setBounds({ x, y, width: w, height: h });
  if (below !== bubbleBelow) {
    bubbleBelow = below;
    if (bubbleWindow.isVisible() && bubblePayload) {
      bubbleWindow.webContents.send(CH.BUBBLE_CONTENT, Object.assign({}, bubblePayload, { below }));
    }
  }
}

// 跟随保险：气泡可见期间每 50ms 校正一次位置。覆盖 IPC 丢帧 / 系统节流 / 事件遗漏，
// 保证气泡始终跟着 lolo（走路、拖拽、多显示器都稳）。
setInterval(() => {
  if (bubbleWindow && bubbleWindow.isVisible() && petWindow) positionBubbleWindow(true);
}, 50);

// 统一的“显示气泡”入口：桌宠请求（BUBBLE_SHOW）与主进程主动弹出（如自动更新提示）共用，
// 保证都走「先定位 → 再下发 → 未就绪先缓存 → showInactive」这同一套安全流程。
function showBubbleNow(p) {
  const win = ensureBubbleWindow();
  bubblePayload = p || {};
  positionBubbleWindow(true); // 先定位（顺带算出 above/below）
  // 带上当前语言，气泡渲染端的兜底文案（标题/提示）才能跟随界面语言
  const content = Object.assign({}, bubblePayload, { below: bubbleBelow, lang: currentLang });
  // 渲染端未就绪则先缓存，did-finish-load 后再下发，避免内容被丢弃
  if (bubbleReady) {
    win.webContents.send(CH.BUBBLE_CONTENT, content);
  } else {
    bubblePending = content;
  }
  if (!win.isVisible()) win.showInactive();
}

ipcMain.on(CH.BUBBLE_SHOW, (e, p) => {
  showBubbleNow(p);
});

ipcMain.on(CH.BUBBLE_HIDE, () => { if (bubbleWindow && bubbleWindow.isVisible()) bubbleWindow.hide(); });

// 兼容保留：气泡已改为固定尺寸窗口，不再按内容 resize（见顶部注释）
ipcMain.on(CH.BUBBLE_SIZE, () => {});

// 气泡被点击（提醒气泡=用户确认关闭）→ 隐藏并通知桌宠结束提醒状态
ipcMain.on(CH.BUBBLE_DISMISSED, (e, p) => {
  if (bubbleWindow && bubbleWindow.isVisible()) bubbleWindow.hide();
  // 更新气泡：由主进程直接闭环处理（依当前阶段决定「开始下载」或「重启安装」），
  // 不再转发给桌宠——否则会被当成普通提醒处理而误触发 goIdle。
  if (p && p.kind === 'update') { handleUpdateBubbleClick(); return; }
  if (petWindow) petWindow.webContents.send(CH.BUBBLE_DISMISSED, p || {});
});

// ---------- 自动更新（electron-updater + generic 静态托管，例如 Cloudflare R2）----------
// 设计约束（关系到「不改动现有成品 exe」，务必遵守）：
// 1) 便携版（portable = 单文件自解压 exe）**完全不参与**自动更新：它运行时解压到临时目录执行，
//    Electron 会把原 exe 路径放进 process.env.PORTABLE_EXECUTABLE_FILE。据此判定——
//    便携版连 electron-updater 都不 require，行为与现有成品 100% 一致，绝无副作用。
// 2) 仅 NSIS 安装版（且 app.isPackaged，非开发模式）启用更新。
// 3) 不自动下载：先弹气泡询问，用户点击后才下载；下载完再点击才重启安装，绝不擅自重启。
const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_FILE;
const UPDATER_ENABLED = app.isPackaged && !IS_PORTABLE;
// macOS 自动更新强制要求签名+公证（否则 quitAndInstall 被 Gatekeeper 拦截），
// 未签名的 Mac 版改为「提醒 + 引导前往 Releases 手动下载」。
const RELEASES_URL = 'https://github.com/3183276820-afk/lolo/releases';

let autoUpdater = null;
let updateStage = 'idle'; // idle | available | downloading | downloaded

if (UPDATER_ENABLED) {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false; // 由用户确认后再下载，避免突然占用流量

  autoUpdater.logger = {
    info: (m) => slog('[updater]', m),
    warn: (m) => slog('[updater]', m),
    error: (m) => slog('[updater]', m),
    debug: () => {} // 太吵，丢弃
  };

  autoUpdater.on('update-available', (info) => {
    const v = (info && info.version) || '';
    slog('[updater] 发现新版本 ' + v);
    if (process.platform === 'darwin') {
      // macOS 未签名：无法走 quitAndInstall 自动安装（Gatekeeper 会拦截），改为提醒并引导手动下载
      updateStage = 'mac-guide';
      showBubbleNow({
        kind: 'update', title: t('updater.foundTitle') + v,
        text: t('updater.macGuideHint'), hint: t('updater.openDownload'), fontSize: 13
      });
    } else {
      updateStage = 'available';
      showBubbleNow({
        kind: 'update', title: t('updater.foundTitle') + v,
        text: t('updater.newVersionText'), hint: t('updater.clickDownload'), fontSize: 13
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    updateStage = 'idle';
    slog('[updater] 已是最新版本');
  });

  autoUpdater.on('download-progress', (p) => {
    const pct = Math.round((p && p.percent) || 0);
    if (pct % 20 === 0) slog('[updater] 下载进度 ' + pct + '%');
    showBubbleNow({
      kind: 'update', title: t('updater.downloading'),
      text: t('updater.progress') + pct + '%', hint: t('updater.downloadHint'), fontSize: 13
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateStage = 'downloaded';
    const v = (info && info.version) || '';
    slog('[updater] 更新已下载 v' + v);
    showBubbleNow({
      kind: 'update', title: t('updater.readyTitle') + v,
      text: t('updater.readyText'), hint: t('updater.clickInstall'), fontSize: 13
    });
  });

  autoUpdater.on('error', (err) => {
    updateStage = 'idle';
    slog('[updater] 失败:', (err && (err.message || err.stack)) || String(err));
  });
}

// 更新气泡被点击：依当前阶段推进
function handleUpdateBubbleClick() {
  if (!UPDATER_ENABLED || !autoUpdater) return;
  try {
    if (updateStage === 'mac-guide') {
      // macOS 未签名：不自动下载/安装，只引导用户去 Releases 手动下载
      slog('[updater] Mac 引导：打开 Releases 下载页');
      shell.openExternal(RELEASES_URL);
      return;
    }
    if (updateStage === 'available') {
      updateStage = 'downloading';
      slog('[updater] 用户确认，开始下载');
      showBubbleNow({ kind: 'update', title: t('updater.downloading'), text: t('updater.preparing'), hint: t('updater.downloadHint'), fontSize: 13 });
      autoUpdater.downloadUpdate();
    } else if (updateStage === 'downloaded') {
      slog('[updater] 用户确认，重启安装');
      autoUpdater.quitAndInstall(false, true); // 非静默；安装完成后重启
    }
  } catch (err) {
    slog('[updater] 处理点击失败:', err && (err.message || err));
  }
}

// 桌宠/面板 → 主进程：手动检查更新（右键菜单「检查更新」）
ipcMain.on(CH.UPDATE_CHECK, () => {
  if (!UPDATER_ENABLED || !autoUpdater) { slog('[updater] 便携版/开发模式：跳过检查'); return; }
  autoUpdater.checkForUpdates().catch((err) => slog('[updater] 手动检查失败:', err && err.message));
});

// 启动后延迟检查：不拖慢启动，也不和开机自启抢资源
function scheduleUpdateCheck() {
  if (!UPDATER_ENABLED || !autoUpdater) {
    slog('[updater] 跳过（便携版或开发模式）—— 现有 exe 行为完全不受影响');
    return;
  }
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => slog('[updater] 启动检查失败:', err && err.message));
  }, 12000);
}

ipcMain.handle(CH.GET_BOUNDS, () => (petWindow ? petWindow.getBounds() : null));
ipcMain.on(CH.SET_BOUNDS, (e, b) => {
  if (petWindow && b && !petWindow.isDestroyed()) {
    // 关键：宽高用看门狗的期望尺寸（petExpectedSize），而不是 getSize()。
    // getSize() 在 DPI 缩放（125%/150%）下可能已被系统四舍五入漂移，用它写回会形成
    // "每次移动读一次漂移值再写回去"的棘轮，越挪越大（Win10/Win11 都中招的根因）。
    // 用固定期望值则每次移动都重新断言规范尺寸，彻底杜绝爬升。
    const [ew, eh] = petExpectedSize || petWindow.getSize();
    petWindow.setBounds({ x: b.x, y: b.y, width: ew, height: eh });
  }
  // lolo 移动（散步/拖拽）时，悬浮气泡跟随，避免和本体脱节
  if (bubbleWindow && bubbleWindow.isVisible()) positionBubbleWindow(true);
});
ipcMain.on(CH.SET_SIZE, (e, b) => { if (petWindow && b) setPetSize(b.width, b.height); });
ipcMain.handle(CH.GET_SCREEN, () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { width, height };
});

// ---------- 知识产权防护：防窥探 ----------
// 1) 移除默认菜单栏 —— 其中 View 菜单带 Reload / Toggle Developer Tools 入口。
//    注意：项目自己的右键菜单走 Menu.popup()，与此独立，不受任何影响。
Menu.setApplicationMenu(null);

// 2) 拦截本应用所有窗口的开发者工具快捷键：F12 / Ctrl+Shift+I / J / C / Ctrl+U。
//    用 web-contents-created 统一覆盖（桌宠/面板/菜单/气泡四个窗口都生效），
//    且 before-input-event 只在窗口聚焦时触发，不会抢占其它程序的快捷键。
app.on('web-contents-created', (e, wc) => {
  wc.on('before-input-event', (ev, input) => {
    const k = String((input && input.key) || '').toLowerCase();
    const isDevTool =
      k === 'f12' ||
      (input.control && input.shift && (k === 'i' || k === 'j' || k === 'c')) ||
      (input.control && k === 'u');
    if (isDevTool) ev.preventDefault();
  });
  // 禁止通过 window.open 打开新窗口（堵住另一个窥探入口）
  try { wc.setWindowOpenHandler(() => ({ action: 'deny' })); } catch (err) { /* 老版本兼容 */ }
  // 锁定页面缩放级别为 100%：禁止触控板捏合 / Ctrl+滚轮 放大网页，
  // 否则 Mac 等触控设备双指张合会让 lolo “一直变大”（即便本项目主要在 Windows 运行，也一并防住）。
  try { wc.setVisualZoomLevelLimits(1, 1); } catch (err) { /* 旧版 Electron 忽略 */ }
});

// ---------- 启动 ----------
app.whenReady().then(async () => {
  // macOS：lolo 是菜单栏宠物，隐藏 Dock 图标（仅托盘/桌面常驻，不占 Dock）
  if (process.platform === 'darwin') {
    try { app.dock.hide(); } catch (e) {}
  }
  if (!(await instanceReady)) return; // 极罕见兜底：未取得实例锁则不启动
  slog('app ready');
  config = loadConfig();
  // 启动即按「面板偏好 > 系统语言」确定界面语言，并同步内置内容
  applyLanguage();
  slog('config loaded');
  applyAutoStart(!!config.autoStart); // 与「开机自启」配置保持一致（幂等）
  createPetWindow();
  slog('pet window created');
  createPanelWindow();
  createTray();
  slog('tray created');
  startEngine();
  slog('engine started');
  scheduleUpdateCheck(); // 自动更新：仅 NSIS 安装版生效，便携版会自动跳过

  // 首次启动：自动弹出控制面板，确保用户一定能看到窗口
  if (!config.version) {
    slog(t('msg.firstRun'));
    showPanel();
    config.version = 1;
    saveConfig(config);
  }
});

app.on('window-all-closed', (e) => {
  // 保持后台运行（通过托盘退出）
  e.preventDefault();
});
