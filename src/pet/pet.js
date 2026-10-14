const api = window.loloAPI;
const I18N = window.LoloI18n || null;
let lang = 'zh-CN';
let langPref = 'auto'; // 语言偏好（面板下发），避免直接用 TDZ 中的 config
/** 取界面文案；i18n 缺失时原样返回中文 */
function tr(key) { return I18N ? I18N.t(lang, key) : key; }
/** 按当前语言取内置内容字典 */
function contentOf() { return (I18N && I18N.CONTENT[lang]) || null; }
/** 语言跟随配置偏好，未下发配置前按系统语言判定 */
function applyLang(pref) {
  if (pref) langPref = pref;
  lang = I18N ? I18N.resolveLang(langPref, navigator.language || 'zh-CN') : 'zh-CN';
  return lang;
}
applyLang();
if (!api) {
  const ERR_DEF = I18N ? I18N.t(I18N.resolveLang('auto', navigator.language || 'zh-CN'), 'pet.preloadMissing') : '[lolo] window.loloAPI 未定义：preload 未注入，桌宠无法运行';
  const MSG_DEF = I18N ? I18N.t(I18N.resolveLang('auto', navigator.language || 'zh-CN'), 'pet.loadFailed') : 'lolo 加载失败：preload 未注入';
  console.error(ERR_DEF);
  const t = document.createElement('div');
  t.textContent = MSG_DEF;
  t.style.cssText = 'position:fixed;left:6px;top:6px;color:#f55;font:12px/1.4 sans-serif;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:4px;z-index:9999;';
  document.body && document.body.appendChild(t);
  throw new Error('loloAPI not injected');
}
const CH = api.channels;

const stage = document.getElementById('stage');
const videoEl = document.getElementById('pet-video');
const bubbleEl = document.getElementById('bubble');
const toastEl = document.getElementById('toast');
const foodPropEl = document.getElementById('food-prop');
const foodPickerEl = document.getElementById('food-picker');
const reminderEl = document.getElementById('reminder');
const reminderTitleEl = document.getElementById('reminder-title');
const reminderTextEl = document.getElementById('reminder-text');
const focusTimerEl = document.getElementById('focus-timer');

let config = null;
let current = 'sleep';
let prevIdle = 'sleep';
let dragging = false;
let dragOffset = { x: 0, y: 0 };
let pressStart = null;
let moved = false;
let pos = { x: 0, y: 0 };
let screenSize = { width: 1920, height: 1080 };
let walkTimer = null;
let idleTimer = null;
let idleMsgTimer = null;
let lastInteraction = Date.now();
let bubbleTimer = null;
let toastTimer = null;
let walkVel = { x: 1.4, y: 0 };
let facing = 1; // 1=朝右, -1=朝左（走路时按移动方向切换左右素材）
// 提醒相关
let reminderTimer = null;      // 置顶恢复计时
let reminderVisible = false;   // 当前有提醒气泡
let remindBusyUntil = 0;       // 提醒表演期间，闲置监视不抢占
let focusState = { phase: 'idle' };

function randomFrom(arr) {
  return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : '';
}

function getVideoFor(state) {
  if (!config) return '';
  const st = config.states[state];
  let f = st ? st.video : '';
  if (!f) {
    if (state === 'cheer') f = config.states['upside_down'] ? config.states['upside_down'].video : '';
    else if (state === 'turn') f = config.states['walk'] ? config.states['walk'].video : '';
    else if (state === 'deep_sleep') {
      // deep_sleep 是伪状态（config.states 里没有），回退到它实际定格用的素材
      const idle = config.idle || {};
      const ds = idle.deepSleepState || 'lying_back';
      if (ds !== 'deep_sleep') f = getVideoFor(ds);
    }
  }
  return f || '';
}

function stateDuration(state) {
  const st = config && config.states[state];
  return (st && st.duration) ? st.duration : 1.5;
}

let animTimer = null;
// 动作保护：一次性动作（倒立/加油/转身/放下）播放期间，闲置监视不得抢占回睡觉
let actionUntil = 0;
function beginAction(state, extraMs) {
  const d = stateDuration(state) || 1.5;
  actionUntil = Math.max(actionUntil, Date.now() + d * 1000 + (extraMs || 0));
}
// 素材为带透明通道的 APNG，<img> 自动循环播放，无需 play()
// force=true 时强制重播：浏览器对「src 相同」的 APNG 不会重新加载/从头播放，
// 连续播放同一动作（如连续喝水提醒）时会导致动画“只第一两次出现”。
// 关键教训：绝不能给 file:// 资源拼 ?query 来制造“新 URL”——Chromium 对 file://
// 的 query 处理异常，<img> 的 load 事件根本不触发（既不成功也不报错），动画整段消失。
// 正确做法：请主进程读取文件字节，用唯一 blob: URL 重新赋值，浏览器必重新加载并重启 APNG。
function setVideo(file, force) {
  if (!file) {
    // 取不到素材时保持上一帧，避免桌宠整只"消失"
    api.send(CH.DEBUG_LOG, 'setVideo: 空素材，保持上一帧 state=' + current);
    return;
  }
  videoEl.style.visibility = 'visible';
  if (force && api.readAsset) {
    // 主进程读文件字节 -> 唯一 blob: URL，绕开 file:// query 的失效问题，强制重播 APNG
    api.readAsset(file).then((buf) => {
      if (buf && buf.byteLength) {
        const blob = new Blob([buf], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        videoEl.setAttribute('src', url);
        api.send(CH.DEBUG_LOG, 'setVideo: force blob OK bytes=' + buf.byteLength);
      } else if (videoEl.getAttribute('src') !== file) {
        videoEl.setAttribute('src', file);
        api.send(CH.DEBUG_LOG, 'setVideo: force fallback file');
      }
    }).catch(() => {
      if (videoEl.getAttribute('src') !== file) videoEl.setAttribute('src', file);
      api.send(CH.DEBUG_LOG, 'setVideo: force catch fallback file');
    });
    return;
  }
  if (videoEl.getAttribute('src') !== file) videoEl.setAttribute('src', file);
  api.send(CH.DEBUG_LOG, 'setVideo: src=' + file);
}

// 诊断：记录图片加载成功/失败，写入 startup.log 便于排查"桌宠不可见"
videoEl.addEventListener('load', () => api.send(CH.DEBUG_LOG, 'img 加载成功: ' + videoEl.getAttribute('src')));
videoEl.addEventListener('error', () => api.send(CH.DEBUG_LOG, 'img 加载失败: ' + videoEl.getAttribute('src')));

function stopWalk() {
  if (walkTimer) { clearInterval(walkTimer); walkTimer = null; }
}

function startWalk() {
  stopWalk();
  walkVel = { x: (Math.random() < 0.5 ? -1 : 1) * 1.4, y: (Math.random() < 0.5 ? -1 : 1) * 0.9 };
  facing = walkVel.x >= 0 ? 1 : -1;
  walkTimer = setInterval(() => {
    if (dragging) return; // 拖拽期间让出位置，避免与鼠标抢着 SET_BOUNDS
    const w = config.size.width, h = config.size.height;
    let nx = pos.x + walkVel.x;
    let ny = pos.y + walkVel.y;
    // 撞墙/随机转向只改方向并切换左右素材，不再插入转身动画
    if (nx <= 0 || nx + w >= screenSize.width) { walkVel.x *= -1; nx = pos.x + walkVel.x; }
    if (ny <= 0 || ny + h >= screenSize.height) { walkVel.y *= -1; ny = pos.y + walkVel.y; }
    if (Math.random() < 0.008) { walkVel.x *= -1; if (Math.random() < 0.5) walkVel.y *= -1; }
    const dir = walkVel.x >= 0 ? 1 : -1;
    if (dir !== facing) {
      facing = dir;
      setVideo(getVideoFor(dir === -1 ? 'walk_left' : 'walk'));
    }
    pos.x = nx; pos.y = ny;
    api.send(CH.SET_BOUNDS, { x: Math.round(nx), y: Math.round(ny) });
  }, 40);
}

function playTurn() {
  const tf = getVideoFor('turn');
  if (!tf) return;
  clearTimeout(animTimer);
  setVideo(tf);
  beginAction('turn', 300); // 转身播放期间不被闲置监视打断
  // 播完回到进入转身前的状态（走路时回到对应方向的走路素材）
  let back = (current === 'walk') ? (facing === -1 ? 'walk_left' : 'walk') : current;
  // 兜底：转身前若是伪状态/无素材状态，回退到常态，避免播完"消失"
  if (!getVideoFor(back)) back = prevIdle || 'sleep';
  if (!getVideoFor(back)) back = 'sleep';
  animTimer = setTimeout(() => { animTimer = null; setVideo(getVideoFor(back)); }, stateDuration('turn') * 1000);
}

// 专注期间随机出现的两种待机状态（打瞌睡 / 看书）
const FOCUS_IDLE_STATES = ['daze', 'read'];
function hasFocusIdle() {
  return !!(config && config.states && config.states.daze && config.states.daze.video &&
            config.states.read && config.states.read.video);
}
function focusIdleState() {
  // 在两种状态间交替，保证打瞌睡和看书都能出现
  return (current === 'daze') ? 'read' : 'daze';
}

function goIdle() {
  if (focusState.phase === 'running' && hasFocusIdle()) {
    setState(focusIdleState());
    return;
  }
  setState(prevIdle || 'sleep');
}

// 专注期间：维持「打瞌睡 / 看书」待机循环，并在用户切了别的动作后自动回归
let focusIdleTimer = null;
let focusIdleSwitchAt = 0;
function startFocusIdle() {
  if (focusIdleTimer) return;
  focusIdleSwitchAt = Date.now();
  focusIdleTimer = setInterval(() => {
    if (focusState.phase !== 'running') return;
    if (reminderVisible) return;
    if (Date.now() < remindBusyUntil) return; // 提醒表演期间不抢占
    if (Date.now() < actionUntil) return;     // 动作表演期间不抢占
    const inLoop = (current === 'daze' || current === 'read');
    if (inLoop) {
      // 处于专注待机态：每隔约 22s 在打瞌睡/看书间切换，营造随机观感
      if (Date.now() - focusIdleSwitchAt > 22000) {
        focusIdleSwitchAt = Date.now();
        setState(focusIdleState());
      }
      return;
    }
    // 不在循环态：用户从菜单/点击手动切到别的动作后，动作表演结束就自动回到
    // 专注待机循环（看书/打瞌睡）。「睡觉 / 到处走走」属于刻意选择，保留不动，
    // 需点右键菜单「恢复默认待机」手动回归。
    const FOCUS_PERSIST = { sleep: 1, walk: 1 };
    if (FOCUS_PERSIST[current]) return;
    focusIdleSwitchAt = Date.now(); // 回归后重新计时，避免立刻又切换
    goIdle(); // focus running + hasFocusIdle → 回到 看书/打瞌睡 循环
  }, 3000);
}
function stopFocusIdle() {
  if (focusIdleTimer) { clearInterval(focusIdleTimer); focusIdleTimer = null; }
}

// ---------- 喂食 ----------
let feedTimer = null;

function showFoodProp(iconUrl) {
  if (!iconUrl) return; // 图标缺失时静默跳过（用户尚未放入 food_*.png），不报错
  foodPropEl.src = iconUrl;
  foodPropEl.classList.remove('hidden', 'play');
  void foodPropEl.offsetWidth; // 重置动画，保证每次投喂都重新飞入
  foodPropEl.classList.add('play');
}

function hideFoodProp() {
  foodPropEl.classList.remove('play');
  foodPropEl.classList.add('hidden');
}

let wheelRot = 0;            // 轮盘旋转角度
let wheelDragging = false;
let wheelDown = null;
let wheelMoved = false;

function applyWheelRot() {
  const wheel = foodPickerEl.querySelector('#food-wheel');
  if (!wheel) return;
  wheel.style.transform = 'rotate(' + wheelRot + 'deg)';
  // 反向旋转每个按钮，使图标与名字始终正向；并按「上半圆窗口」显隐
  wheel.querySelectorAll('.food-btn').forEach((b) => {
    const base = parseFloat(b.dataset.angle) || 0;
    const cur = (((base + wheelRot) % 360) + 360) % 360; // 归一到 0..360
    // 屏幕坐标 y 向下：角度在 (180,360) 即 sin<0 → 落在 lolo 上方半圆，予以显示
    const inTop = cur > 180 && cur < 360;
    b.classList.toggle('hidden-food', !inTop);
    b.style.transform = 'translate(-50%, -50%) rotate(' + (-wheelRot) + 'deg)';
  });
}

// 喂某一种食物：lolo 播放吃食动画，食物道具飞向嘴边后消失，结束回到闲置
function feedFood(food) {
  if (!food || !food.id) return;
  lastInteraction = Date.now();
  current = 'feed';
  stopWalk();
  clearTimeout(feedTimer);
  // 播放吃食动画（feed.png 缺失时 setVideo 保持上一帧，不会整只消失）
  setVideo(getVideoFor('feed'));
  beginAction('feed', 500); // 喂食期间不被闲置监视拽回睡觉
  sayFor('feed');
  showFoodProp(food.icon);
  const dur = stateDuration('feed') || 2.5;
  feedTimer = setTimeout(() => {
    feedTimer = null;
    hideFoodProp();
    goIdle();
  }, dur * 1000);
}

function openFoodPicker() {
  if (!config || !config.foods || !config.foods.length) {
    showToast(tr('pet.noFood'));
    return;
  }
  const foods = config.foods;
  const n = foods.length;
  const W = window.innerWidth || 240, H = window.innerHeight || 240;
  const cx = W / 2, cy = H / 2;
  // 多于 5 种 → 上半圆旋转轮盘（每次只露 5 个，其余转出）；≤5 种 → 静态铺在上半圆
  const isWheel = n > 5;
  const baseR = Math.min(W, H) / 2 - 24;
  const btn = isWheel ? 44 : Math.min(54, Math.max(42, (Math.PI * baseR / n) * 0.85));

  foodPickerEl.innerHTML = '';
  const wheel = document.createElement('div');
  wheel.id = 'food-wheel';
  foodPickerEl.appendChild(wheel);

  foods.forEach((f, i) => {
    let baseAng;
    if (isWheel) {
      baseAng = -90 + i * (360 / n);           // 整圈均布，靠上半圆窗口显隐
    } else {
      // 静态：均匀铺在「上半圆」（避免压在 lolo 身上）
      baseAng = (n === 1) ? -90 : (-160 + i * (140 / (n - 1)));
    }
    const ang = baseAng * Math.PI / 180;
    const x = cx + baseR * Math.cos(ang);
    const y = cy + baseR * Math.sin(ang);
    const b = document.createElement('button');
    b.className = 'food-btn';
    b.dataset.angle = baseAng;
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.width = btn + 'px';
    b.title = f.name || f.id;
    if (f.icon) {
      const img = document.createElement('img');
      img.src = f.icon;
      img.alt = f.name || f.id;
      b.appendChild(img);
    }
    const lbl = document.createElement('span');
    lbl.className = 'food-name';
    lbl.textContent = f.name || f.id;
    b.appendChild(lbl);
    b.addEventListener('click', (e) => {
      e.stopPropagation(); // 不触发 stage 的拖拽/点击动作
      if (b.classList.contains('hidden-food')) return; // 未转出到上半圆的不响应
      closeFoodPicker();   // 选定食物后菜单立即消失
      feedFood(f);
    });
    wheel.appendChild(b);
  });

  if (isWheel) {
    const hint = document.createElement('div');
    hint.id = 'food-wheel-hint';
    hint.textContent = tr('pet.wheelHint');
    foodPickerEl.appendChild(hint);
  }
  wheelRot = 0;
  applyWheelRot();
  foodPickerEl.classList.toggle('wheel', isWheel);
  foodPickerEl.classList.remove('hidden');
}

function closeFoodPicker() {
  if (foodPickerEl) foodPickerEl.classList.add('hidden');
}

// ---------- 番茄钟：专注计时 ----------
// 时长选择已移入「原生右键菜单的子菜单」：旧的全窗口半透明弹层会盖住 lolo，已废弃
let focusUI = { active: false, wasRunning: false, durationSec: 0, endAt: 0 };
let focusTickTimer = null;

// 番茄钟启动动画：lolo 弯腰看地上的小红计时器 -> 起身挥手打气（focus_start.png）
function playFocusStart() {
  const f = getVideoFor('focus_start');
  if (!f) { // 素材缺失时退回加油动画，保证仍有反馈
    beginAction('cheer');
    setState('cheer');
    return;
  }
  current = 'focus_start';
  stopWalk();
  clearTimeout(animTimer);
  setVideo(f);
  beginAction('focus_start', 500); // 动画播放期间不被闲置监视打断
  animTimer = setTimeout(() => { animTimer = null; goIdle(); }, stateDuration('focus_start') * 1000);
}

// 玩家在专注过程中点击 lolo -> 加油鼓励
function encourageFocus() {
  const pool = (config && config.clickResponses && config.clickResponses.length)
    ? config.clickResponses
    : ((contentOf() && contentOf().cheerPool) || ['加油！']);
  beginAction('cheer');
  setState('cheer');
  showBubble(randomFrom(pool));
}

function stopFocusUI() {
  focusUI.active = false;
  focusUI.wasRunning = false;
  if (focusTickTimer) { clearInterval(focusTickTimer); focusTickTimer = null; }
  focusTimerEl.classList.add('hidden');
}

function updateFocusTimer() {
  if (!focusUI.active) return;
  const remain = Math.max(0, (focusUI.endAt - Date.now()) / 1000);
  const elapsed = Math.max(0, focusUI.durationSec - remain);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
  focusTimerEl.textContent = tr('pet.focusElapsed') + mm + ':' + ss;
}

// 根据主进程下发的专注状态，驱动桌宠表现
function onFocusState(st) {
  focusState = st || { phase: 'idle' };
  if (focusState.phase === 'running') {
    // 每次状态刷新都重新校准计时（处理暂停后继续、时长变化）
    focusUI.active = true;
    focusUI.durationSec = (focusState.durationMin || 25) * 60;
    focusUI.endAt = Date.now() + (focusState.remainingSec || focusUI.durationSec) * 1000;
    focusTimerEl.classList.remove('hidden');
    if (!focusTickTimer) focusTickTimer = setInterval(updateFocusTimer, 500);
    updateFocusTimer();
    // 首次进入本轮专注：播放番茄钟启动动画（弯腰看计时器 -> 挥手打气）
    if (!focusUI.wasRunning) {
      playFocusStart();
      sayFor('focus_start');
      focusUI.wasRunning = true;
    }
    startFocusIdle();
  } else {
    stopFocusUI();
    stopFocusIdle();
    if (focusState.phase === 'idle') {
      // 专注结束：回到常规闲置（睡觉/散步，取决于面板设置）
      focusUI.wasRunning = false;
      goIdle();
    }
  }
}

// ---- 食物选择器交互：轮盘旋转 / 点击空白关闭 ----
// #food-picker 容器已设 pointer-events:none（不挡 lolo），故旋转/拖拽监听挂在 document 上，
// 用「选择器是否打开」「是否轮盘模式」来守卫，避免影响 lolo 正常拖拽
function isPickerOpen() { return !foodPickerEl.classList.contains('hidden'); }
function isWheelMode() { return foodPickerEl.classList.contains('wheel'); }

document.addEventListener('wheel', (e) => {
  if (!isPickerOpen() || !isWheelMode()) return;
  e.preventDefault();
  wheelRot += e.deltaY * 0.3;
  applyWheelRot();
}, { passive: false });

document.addEventListener('mousedown', (e) => {
  if (!isPickerOpen() || !isWheelMode()) return;
  if (e.target.closest('.food-btn')) return; // 点在食物上不旋转
  wheelDragging = true;
  wheelMoved = false;
  wheelDown = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mousemove', (e) => {
  if (!wheelDragging) return;
  const dx = e.clientX - wheelDown.x;
  if (Math.abs(dx) > 2) wheelMoved = true;
  wheelRot += dx * 0.6;
  wheelDown = { x: e.clientX, y: e.clientY };
  applyWheelRot();
});

document.addEventListener('mouseup', (e) => {
  if (!wheelDragging) return;
  wheelDragging = false;
  // 轮盘模式下，点空白处（未拖动）视为关闭
  if (!wheelMoved) closeFoodPicker();
});

// 被拎起：播放一遍"拎起来"动画后定格在拎起姿势保持静止（不再循环重复）
function enterGrab() {
  if (current === 'grab') return; // 已在拎起中，避免拖动时反复触发
  current = 'grab';
  stopWalk();
  clearTimeout(animTimer);
  setVideo(getVideoFor('grab')); // 播放拎起动画一遍
  // 动画播完后切到静止定格帧（单帧 PNG，<img> 不会循环）
  const dur = stateDuration('grab') || 0.6;
  animTimer = setTimeout(() => {
    animTimer = null;
    setVideo(getVideoFor('grab_held'));
  }, dur * 1000);
  sayFor('grab'); // 拎起时说一句台词
}

// 按动作说话：优先用该动作的专属台词(messages)，没有则回退通用语句
function sayFor(state) {
  if (!config) return;
  let st = config.states[state];
  if ((!st || !st.messages || !st.messages.length) && state === 'walk_left') st = config.states['walk'];
  const arr = (st && st.messages && st.messages.length) ? st.messages
            : (state === 'sleep' || state === 'walk') ? config.idleMessages : config.clickResponses;
  if (arr && arr.length) showBubble(randomFrom(arr));
}

function setState(state, opts) {
  opts = opts || {};
  current = state;
  stopWalk();
  if (state === 'walk') startWalk();
  // 走路按当前朝向取左/右素材
  const file = getVideoFor(state === 'walk' && facing === -1 ? 'walk_left' : state);
  clearTimeout(animTimer);
  if (state === 'drop' && !opts.fromDrop) {
    setVideo(file);
  } else if (opts.fromDrop) {
    setVideo(file);
    beginAction(state);
    animTimer = setTimeout(() => { animTimer = null; goIdle(); }, stateDuration(state) * 1000);
  } else {
    setVideo(file, opts.force);
  }
}

function showBubble(text) {
  if (!text) return;
  // 气泡改为独立悬浮窗口（lolo 头顶外侧），不再画在桌宠窗口内——
  // 桌宠窗口就是 lolo 本体大小，窗内气泡必然压在身上
  const rb = (config && config.reminderBehavior) || {};
  api.send(CH.BUBBLE_SHOW, { kind: 'say', text, fontSize: rb.bubbleFontSize || 14 });
  clearTimeout(bubbleTimer);
  const durMs = Math.max(1.5, (rb.bubbleDurationSec != null) ? rb.bubbleDurationSec : 6) * 1000;
  bubbleTimer = setTimeout(() => api.send(CH.BUBBLE_HIDE), durMs);
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 1600);
}

function clickAction() {
  const actions = ['upside_down', 'cheer'];
  const act = actions[Math.floor(Math.random() * actions.length)];
  beginAction(act);
  setState(act);
  sayFor(act);
}

// ---------- 提醒音效（Web Audio 本地合成，离线可用） ----------
let audioCtx = null;
function playRingtone(tone) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const notes = tone === 'chime' ? [880, 1174.7, 880]
                : tone === 'soft'  ? [523.3, 659.3]
                : /* glass */        [1567.98, 2093, 1567.98];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'soft' ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const t0 = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  } catch (e) { /* 音频失败不影响提醒 */ }
}

function shakePet() {
  stage.classList.remove('shake');
  void stage.offsetWidth; // 重置动画
  stage.classList.add('shake');
  setTimeout(() => stage.classList.remove('shake'), 900);
}

// ---------- 提醒表现 ----------
function hideReminder() {
  reminderVisible = false;
  api.send(CH.BUBBLE_HIDE);
  clearTimeout(reminderTimer);
  // 回归日常闲逛动画（或睡觉状态）
  goIdle();
}

function onReminder(payload) {
  const rb = (config && config.reminderBehavior) || {};
  const doAction = rb.doAction !== false;
  const showBubbleCfg = rb.showBubble !== false;
  const pinSec = (rb.pinDurationSec != null) ? rb.pinDurationSec : 5;
  const fontPx = rb.bubbleFontSize || 14;
  const bubbleSec = (rb.bubbleDurationSec != null) ? rb.bubbleDurationSec : 6;

  const text = payload && payload.text ? payload.text : '';
  const title = payload && payload.title ? payload.title : tr('pet.reminderTitle');

  // 关键：提醒是「自动事件」，绝不能重置 lastInteraction——否则像「每分钟喝水提醒」
  // 会不断清零空闲计时，导致 deep_sleep 永远触发不了。深睡判定在表演期间已通过
  // remindBusyUntil 暂停（见 startIdleWatch:767），表演结束即恢复真实空闲计时。
  remindBusyUntil = Date.now() + pinSec * 1000 + 1500;

  // 音效 / 震动
  const sd = (config && config.sound) || {};
  if (sd.ringtone !== false) playRingtone(sd.tone || 'glass');
  if (sd.vibrate) shakePet();

  // 喝水类提醒（喝水提醒 / 含“喝水”关键词的日程）：强制播放喝水动画，
  // 不受「提醒时播放动作」开关影响——它的意义就是提醒喝水，没喝水动画等于没提醒。
  const wantsDrink = (payload && payload.action) === 'drink';

  // 喝水：无论如何立即强制播放，且彻底脱离“睡觉先转身”分支——睡觉态也直接喝，
  // 不再走 3 秒转身过渡（否则用户会以为喝水动画没出来）。这是“只有睡觉态偶尔不播”
  // 问题的根治点：此前喝水被裹在 startAction 里，而 file:// 下 ?_r= 时间戳换 URL
  // 不能稳定重启动画；现在用 setVideo 的 removeAttribute 强制重播，且显式优先执行。
  if (wantsDrink) {
    setState('drink', { force: true });
  }

  // 动作衔接：非喝水提醒时，睡觉中先播放「转身」片段作为惊醒/伸懒腰过渡
  const startAction = () => {
    if (doAction && !wantsDrink) {
      // 动作优先级：面板配置 > 默认加油（喝水已由上方单独处理）
      const act = rb.action || 'cheer';
      if (act === 'walk') { prevIdle = prevIdle || 'walk'; setState('walk'); }
      else setState(act, { force: true }); // 强制重播：连续同类动作动画必现
    }
    // 置顶显示 pinSec 秒后恢复常态
    clearTimeout(reminderTimer);
    reminderTimer = setTimeout(() => {
      if (reminderVisible) hideReminder();
      else goIdle();
    }, pinSec * 1000);
  };

  if (!wantsDrink) {
    // 睡觉中（非喝水提醒）：先播转身过渡再衔接动作
    if (current === 'sleep' && doAction) {
      const tf = getVideoFor('turn');
      if (tf) {
        clearTimeout(animTimer);
        setVideo(tf, true);
        animTimer = setTimeout(() => { animTimer = null; startAction(); }, stateDuration('turn') * 1000);
      } else {
        startAction();
      }
    } else {
      startAction();
    }
  }

  // 提醒气泡：独立悬浮窗口显示（可点击关闭；到时自动消失）
  if (showBubbleCfg && text) {
    reminderVisible = true;
    api.send(CH.BUBBLE_SHOW, { kind: 'reminder', title, text, fontSize: fontPx });
    clearTimeout(reminderTimer);
    reminderTimer = setTimeout(() => hideReminder(), bubbleSec * 1000);
  }
}

// 气泡窗口被点击：提醒气泡 → 结束本次提醒（等同旧 DOM 气泡的点击关闭）
api.onBubbleDismissed((p) => {
  const kind = p && p.kind;
  if (kind === 'reminder') {
    if (!reminderVisible) return;
    clearTimeout(reminderTimer);
    reminderVisible = false;
    api.send(CH.BUBBLE_HIDE);
    goIdle();
  } else {
    // 日常说话气泡：点击即消失
    clearTimeout(bubbleTimer);
    api.send(CH.BUBBLE_HIDE);
  }
});

// ---------- 拖拽 + 点击 ----------
stage.addEventListener('mousedown', (e) => {
  // 食物选择器打开时，整窗都不应触发 lolo 拖拽（否则点空白处关闭时会误拖）
  if (!foodPickerEl.classList.contains('hidden')) return;
  if (e.button !== 0 || (e.target && e.target.closest && (e.target.closest('#food-picker') || e.target.closest('#reminder')))) return;
  lastInteraction = Date.now();
  pressStart = { x: e.screenX, y: e.screenY };
  moved = false;
});

document.addEventListener('mousemove', (e) => {
  if (!pressStart) return;
  if (!moved) {
    const dx = e.screenX - pressStart.x, dy = e.screenY - pressStart.y;
    if (Math.hypot(dx, dy) > 6) {
      moved = true;
      dragging = true;
      api.invoke(CH.GET_BOUNDS).then((b) => {
        dragOffset.x = pressStart.x - b.x;
        dragOffset.y = pressStart.y - b.y;
      });
      enterGrab();
    }
  }
  if (dragging) {
    const nx = Math.round(e.screenX - dragOffset.x);
    const ny = Math.round(e.screenY - dragOffset.y);
    pos.x = nx; pos.y = ny; // 同步本地坐标，松手后散步从落点继续，不回弹
    api.send(CH.SET_BOUNDS, { x: nx, y: ny });
    clearTimeout(bubbleTimer); // 拖拽期间保持台词气泡不自动消失
  }
});

document.addEventListener('mouseup', () => {
  if (!pressStart) return;
  const wasDrag = dragging;
  pressStart = null;
  dragging = false;
  if (wasDrag) { setState('drop', { fromDrop: true }); sayFor('drop'); } // 放下时说一句台词
  else {
    lastInteraction = Date.now();
    if (focusState.phase === 'running') encourageFocus(); // 专注中点击 = 加油鼓励
    else clickAction();
  }
});

// ---------- 右键菜单（原生系统菜单） ----------
// 菜单改为操作系统原生浮层（main.js 里 Menu.popup），不再画在桌宠小窗里，
// 弹出时完全不遮挡 lolo；此处只负责：右键 -> 请求主进程弹菜单、接收菜单动作并执行。
const PET_MENU_ACTIONS = {
  sleep: () => { prevIdle = 'sleep'; setState('sleep'); sayFor('sleep'); },
  walk: () => { prevIdle = 'walk'; setState('walk'); sayFor('walk'); },
  // 恢复默认待机：专注期间回到「看书/打瞌睡」专注待机循环；否则回到面板「闲置默认模式」
  idle_restore: () => {
    if (focusState.phase === 'running' && hasFocusIdle()) {
      goIdle(); // 回到专注待机循环（看书/打瞌睡）
    } else {
      prevIdle = (config && config.idle && config.idle.autoMode) || 'sleep';
      setState(prevIdle);
      sayFor(prevIdle);
    }
  },
  upside_down: () => { beginAction('upside_down'); setState('upside_down'); sayFor('upside_down'); },
  cheer: () => { beginAction('cheer'); setState('cheer'); sayFor('cheer'); },
  turn: () => { playTurn(); sayFor('turn'); },
  feed: () => { lastInteraction = Date.now(); openFoodPicker(); },
  drink: () => { beginAction('drink'); setState('drink', { force: true }); sayFor('drink'); }
};

api.onPetMenu((action) => {
  lastInteraction = Date.now();
  const fn = PET_MENU_ACTIONS[action];
  if (fn) fn();
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  lastInteraction = Date.now();
  // 把光标的屏幕坐标传给主进程，由自建菜单窗口在光标处弹出（并自动避开 lolo）
  const pos = { x: e.screenX, y: e.screenY };
  api.invoke(CH.PET_CONTEXT_MENU, pos);
});

document.addEventListener('click', (e) => {
  if (!foodPickerEl.classList.contains('hidden') && !foodPickerEl.contains(e.target)) closeFoodPicker();
});

// ---------- 闲置监视 ----------
// 深度睡眠：长时间无操作 -> 播放「翻身」过渡 -> 定格在仰躺那一帧保持
function enterDeepSleep() {
  current = 'deep_sleep';
  stopWalk();
  const idle = (config && config.idle) || {};
  const finalState = idle.deepSleepState || 'lying_back';
  const intro = idle.deepSleepIntro || 'roll_over';
  const finalFile = getVideoFor(finalState);
  clearTimeout(animTimer);
  // 选「仰躺」时先播翻身动画再定格；选「趴着睡」则直接保持不翻身
  if (finalState !== 'sleep' && intro && intro !== finalState) {
    const introFile = getVideoFor(intro);
    if (introFile && finalFile) {
      setVideo(introFile);
      animTimer = setTimeout(() => { animTimer = null; setVideo(finalFile); }, stateDuration(intro) * 1000);
      return;
    }
  }
  setVideo(finalFile);
}

function startIdleWatch() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    if (dragging) return;
    if (focusState.phase === 'running') return; // 专注期间不被闲置监视拽回睡觉
    if (Date.now() < remindBusyUntil) return; // 提醒表演期间不抢占
    if (Date.now() < actionUntil) return;     // 动作表演期间不抢占（修：动作播一半被切回睡觉）
    const idle = (config && config.idle) || {};
    const timeout = idle.idleTimeoutMs || 8000;
    const deepSec = idle.deepSleepSec || 0;
    const walkMin = idle.idleWalkMin || 0;
    const idleMs = Date.now() - lastInteraction;
    // 1) 长时间无操作 -> 自动到处走走（最大阈值，优先判断；0=关闭）
    if (walkMin > 0 && idleMs > walkMin * 60000) {
      // 起身去散步；把散步设为常态，避免随后被"普通闲置"判回睡觉
      if (current !== 'walk') { prevIdle = 'walk'; setState('walk'); }
      return;
    }
    // 2) 深度睡眠：deepSleepSec 秒无操作 -> 翻身 -> 定格仰躺
    //    正在散步时不打断（散步是用户选择的持续状态）
    if (deepSec > 0 && idleMs > deepSec * 1000) {
      if (current !== 'deep_sleep' && current !== 'walk') enterDeepSleep();
      return;
    }
    // 3) 普通闲置
    if (idleMs > timeout) {
      if (current !== 'sleep' && current !== 'walk') goIdle();
      else if (current !== prevIdle) goIdle();
    }
  }, 1000);
}

function startIdleMsg() {
  if (idleMsgTimer) clearInterval(idleMsgTimer);
  idleMsgTimer = setInterval(() => {
    if (dragging) return;
    if (reminderVisible) return;
    if ((current === 'sleep' || current === 'walk' || current === prevIdle) && Date.now() - lastInteraction > 3000) {
      if (Math.random() < 0.35) {
        // 优先说当前动作的专属台词
        const st = config && config.states[current];
        const pool = (st && st.messages && st.messages.length) ? st.messages : config.idleMessages;
        showBubble(randomFrom(pool));
      }
    }
  }, 9000);
}

// ---------- 配置同步 ----------
let firstConfig = true;
function applyConfig(cfg) {
  config = cfg;
  applyLang((cfg && cfg.language) || 'auto'); // 语言先到位，后续提示/吐司才是正确语言
  // 闲置默认模式以配置为准（旧代码 if(!prevIdle) 永远不成立，
  // 导致面板里改「闲置默认模式」保存后从不生效）
  prevIdle = (cfg.idle && cfg.idle.autoMode) || prevIdle || 'sleep';
  api.send(CH.SET_SIZE, { width: cfg.size.width, height: cfg.size.height });
  api.invoke(CH.GET_SCREEN).then((s) => { screenSize = s; });
  api.invoke(CH.GET_BOUNDS).then((b) => { pos = { x: b.x, y: b.y }; });

  if (!config.states[current]) current = 'sleep';
  api.send(CH.DEBUG_LOG, 'applyConfig: state=' + current + ' src=' + getVideoFor(current));
  setVideo(getVideoFor(current), true);
  if (current === 'walk') startWalk();
  startIdleWatch();
  startIdleMsg();
  showToast(firstConfig ? tr('pet.started') : tr('pet.configSynced'));
  firstConfig = false;
}

api.onConfig(applyConfig);
api.onReminder(onReminder);
api.onFocusState(onFocusState);
