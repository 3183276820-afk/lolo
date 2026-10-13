const api = window.loloAPI;
const CH = api ? api.channels : null;
if (!api) {
  console.error('[lolo-panel] window.loloAPI 未定义：preload 未注入，面板功能不可用');
}

const BASE = 240;
let working = null;

// ---------- 元素 ----------
const $ = (id) => document.getElementById(id);
const assetListEl = $('asset-list');
const phraseListEl = $('phrase-list');
const clickTA = $('click-responses');
const idleTA = $('idle-messages');
const scaleInput = $('scale');
const scaleVal = $('scale-val');
const wInput = $('width');
const hInput = $('height');
const timeoutInput = $('timeout');
const autoModeSel = $('auto-mode');
const deepSleepSecInput = $('deep-sleep-sec');
const deepSleepStateSel = $('deep-sleep-state');
const idleWalkMinInput = $('idle-walk-min');
const autoStartEl = $('auto-start');
const hint = $('hint');
const foodListEl = $('food-list');
const addFoodBtn = $('add-food');

// 专注 & 提醒
const focusDur = $('focus-duration');
const focusDurVal = $('focus-duration-val');
const focusAutorun = $('focus-autorun');
const focusStrict = $('focus-strict');
const focusStatus = $('focus-status');
const waterEnabled = $('water-enabled');
const waterInterval = $('water-interval');
const soundEnabled = $('sound-enabled');
const soundTone = $('sound-tone');
const soundVibrate = $('sound-vibrate');
const rbAction = $('rb-action');
const rbActionName = $('rb-action-name');
const rbBubble = $('rb-bubble');
const rbPin = $('rb-pin');
const bubbleFont = $('bubble-font');
const bubbleFontVal = $('bubble-font-val');
const bubbleDuration = $('bubble-duration');
const scheduleList = $('schedule-list');

const STATES = [
  { key: 'sleep', label: '睡觉' },
  { key: 'walk', label: '到处走走(右)' },
  { key: 'walk_left', label: '到处走走(左)' },
  { key: 'turn', label: '转身(右键触发)' },
  { key: 'upside_down', label: '倒立' },
  { key: 'grab', label: '被拎起(拖拽时)' },
  { key: 'drop', label: '被放下(松手时)' },
  { key: 'cheer', label: '加油' },
  { key: 'roll_over', label: '翻身(深睡过渡)' },
  { key: 'lying_back', label: '仰躺(深睡定格)' },
  { key: 'feed', label: '喂食' },
  { key: 'focus_start', label: '番茄钟启动' },
  { key: 'drink', label: '喝水' },
  { key: 'daze', label: '打瞌睡(专注待机)' },
  { key: 'read', label: '看书(专注待机)' }
];

function splitLines(s) {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}

// ---------- 标签页 ----------
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.pane').forEach((p) => p.classList.add('hidden'));
    t.classList.add('active');
    $('pane-' + t.dataset.tab).classList.remove('hidden');
  });
});

// ---------- 素材管理 ----------
function buildAssetList() {
  assetListEl.innerHTML = '';
  STATES.forEach((st) => {
    const row = document.createElement('div');
    row.className = 'asset-row';

    const name = document.createElement('div');
    name.className = 'asset-name';
    name.textContent = st.label;

    const file = document.createElement('div');
    file.className = 'asset-file';
    const v = working.states[st.key] && working.states[st.key].video;
    file.textContent = v ? v : '（未设置）';

    const btn = document.createElement('button');
    btn.className = 'small ghost2';
    btn.textContent = '上传/更换';
    btn.onclick = () => uploadFor(st.key);

    row.appendChild(name);
    row.appendChild(file);
    row.appendChild(btn);
    assetListEl.appendChild(row);
  });
}

function uploadFor(state) {
  api.invoke(CH.PICK_FILE, { accept: 'video/*' }).then((res) => {
    if (!res) return;
    api.send(CH.UPLOAD_ASSET, { state, name: res.name, data: res.data });
    hint.textContent = '素材已上传，桌宠实时同步';
  }).catch((e) => { console.error('[lolo] 选择视频失败', e); });
}

// ---------- 动作台词（不同动作对应相应的语句） ----------
function buildPhraseList() {
  if (!phraseListEl) return;
  phraseListEl.innerHTML = '';
  STATES.forEach((st) => {
    const row = document.createElement('div');
    row.className = 'phrase-row';

    const label = document.createElement('label');
    label.className = 'phrase-label';
    label.textContent = st.label;

    const ta = document.createElement('textarea');
    ta.className = 'phrase-ta';
    ta.rows = 2;
    ta.dataset.state = st.key;
    ta.placeholder = '每行一条，留空使用通用语句';
    const msgs = (working.states[st.key] && working.states[st.key].messages) || [];
    ta.value = msgs.join('\n');

    row.appendChild(label);
    row.appendChild(ta);
    phraseListEl.appendChild(row);
  });
}

function collectPhrases() {
  if (!phraseListEl) return;
  phraseListEl.querySelectorAll('textarea.phrase-ta').forEach((ta) => {
    const key = ta.dataset.state;
    if (!working.states[key]) working.states[key] = { video: key + '.png', duration: 1.0, label: key };
    working.states[key].messages = splitLines(ta.value);
  });
}

// ---------- 喂食食物管理 ----------
function uploadFoodIcon(foodId, idx, cb) {
  api.invoke(CH.PICK_FILE, { accept: 'image/*' }).then((res) => {
    if (!res) return;
    api.invoke(CH.UPLOAD_FOOD_ICON, { foodId, name: res.name, data: res.data })
      .then((filename) => {
        // 把图标写回面板工作副本，并立刻持久化到主进程 config，
        // 否则：① 面板 working 里图标永远是空串、列表只显示「无」；
        // ② 未点“保存”的新食物没进 config，handler 找不到它，
        //    其末尾的 sendPanel(CONFIG_FOR_PANEL) 会用“没有该食物的 config”覆盖 working，把整条食物吞掉。
        if (working.foods[idx]) working.foods[idx].icon = filename;
        api.send(CH.SAVE_CONFIG, working);
        cb(filename);
      });
  }).catch((e) => { console.error('[lolo] 选择图标失败', e); });
}

function buildFoodList() {
  if (!foodListEl) return;
  foodListEl.innerHTML = '';
  const foods = working.foods || [];
  foods.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'food-row';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'food-icon';
    if (f.icon) {
      const img = document.createElement('img');
      api.invoke(CH.ASSET_URL, f.icon).then((u) => { if (u) img.src = u; });
      iconWrap.appendChild(img);
    } else {
      iconWrap.textContent = '无';
    }

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'food-name';
    name.placeholder = '食物名称';
    name.value = f.name || '';
    name.oninput = () => { working.foods[idx].name = name.value; };

    const up = document.createElement('button');
    up.className = 'small ghost2';
    up.textContent = '上传图标';
    up.onclick = () => uploadFoodIcon(f.id, idx, (fn) => {
      working.foods[idx].icon = fn;
      buildFoodList();
    });

    const del = document.createElement('button');
    del.className = 'danger food-del';
    del.textContent = '删除';
    del.onclick = () => { working.foods.splice(idx, 1); buildFoodList(); };

    item.appendChild(iconWrap);
    item.appendChild(name);
    item.appendChild(up);
    item.appendChild(del);
    foodListEl.appendChild(item);
  });
  if (!foods.length) {
    const empty = document.createElement('p');
    empty.className = 'hint-text';
    empty.textContent = '暂无食物，点击右上角「＋ 新增食物」添加一种';
    foodListEl.appendChild(empty);
  }
}

// ---------- 日程事项 ----------
const REPEAT_LABEL = { once: '仅一次', weekdays: '每周工作日', daily: '每天' };

function renderSchedules() {
  scheduleList.innerHTML = '';
  (working.schedules || []).forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'sch-item';

    // 第一行：开关 + 标题 + 删除
    const main = document.createElement('div');
    main.className = 'sch-main';

    // 开关必须是 <label>（内含 input+i）：用 <span> 时点击滑块不会切换 checkbox，
    // 这就是「日程/专注等开关点了没反应」的根本原因
    const tg = document.createElement('label');
    tg.className = 'toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.enabled !== false;
    cb.onchange = () => { working.schedules[idx].enabled = cb.checked; };
    tg.appendChild(cb);
    tg.appendChild(document.createElement('i'));

    const title = document.createElement('input');
    title.className = 'title';
    title.placeholder = '事项标题，如：项目会议';
    title.value = s.title || '';
    title.oninput = () => { working.schedules[idx].title = title.value; };

    const del = document.createElement('button');
    del.className = 'danger sch-del';
    del.textContent = '删除';
    del.onclick = () => { working.schedules.splice(idx, 1); renderSchedules(); };

    main.appendChild(tg);
    main.appendChild(title);
    main.appendChild(del);

    // 第二行：时间 / 重复 / 提前提醒
    const sub = document.createElement('div');
    sub.className = 'sch-sub';

    sub.appendChild(document.createTextNode('执行时间'));
    const time = document.createElement('input');
    time.type = 'time';
    time.value = s.time || '09:00';
    time.onchange = () => { working.schedules[idx].time = time.value; };
    sub.appendChild(time);

    sub.appendChild(document.createTextNode('重复'));
    const rep = document.createElement('select');
    [['once', '仅一次'], ['weekdays', '每周工作日'], ['daily', '每天']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      rep.appendChild(o);
    });
    rep.value = s.repeat || 'once';
    rep.onchange = () => { working.schedules[idx].repeat = rep.value; };
    sub.appendChild(rep);

    sub.appendChild(document.createTextNode('提前'));
    const lead = document.createElement('select');
    [['0', '准时'], ['5', '5 分钟'], ['15', '15 分钟'], ['30', '30 分钟'], ['60', '60 分钟'], ['custom', '自定义']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      lead.appendChild(o);
    });
    const known = ['0', '5', '15', '30', '60'];
    lead.value = known.includes(String(s.leadMin)) ? String(s.leadMin) : (s.leadMin ? 'custom' : '0');
    sub.appendChild(lead);

    let leadCustom = null;
    if (lead.value === 'custom') {
      leadCustom = document.createElement('input');
      leadCustom.type = 'number';
      leadCustom.min = '1'; leadCustom.max = '720';
      leadCustom.value = s.leadMin || 30;
      leadCustom.onchange = () => { working.schedules[idx].leadMin = parseInt(leadCustom.value, 10) || 30; };
      sub.appendChild(leadCustom);
      sub.appendChild(document.createTextNode('分钟'));
    }
    lead.onchange = () => {
      working.schedules[idx].leadMin = (lead.value === 'custom') ? 30 : parseInt(lead.value, 10);
      renderSchedules();
    };

    item.appendChild(main);
    item.appendChild(sub);
    scheduleList.appendChild(item);
  });

  if (!(working.schedules || []).length) {
    const empty = document.createElement('p');
    empty.className = 'hint-text';
    empty.textContent = '暂无日程，点击右上角「＋ 新增日程」添加一条提醒事项';
    scheduleList.appendChild(empty);
  }
}

$('add-schedule').onclick = () => {
  if (!working.schedules) working.schedules = [];
  working.schedules.push({
    id: 'sch_' + Date.now(),
    title: '',
    time: '09:00',
    repeat: 'once',
    leadMin: 30,
    enabled: true
  });
  renderSchedules();
};

addFoodBtn.onclick = () => {
  if (!working.foods) working.foods = [];
  const id = 'food_' + Date.now().toString(36);
  working.foods.push({ id, name: '新食物', icon: '' });
  buildFoodList();
};

// ---------- 焦点控件联动 ----------
focusDur.addEventListener('input', () => {
  focusDurVal.textContent = focusDur.value + ' 分钟';
});
bubbleFont.addEventListener('input', () => {
  bubbleFontVal.textContent = bubbleFont.value + ' px';
});
// 缩放滑块：尺寸主控件。拖动即实时改变 lolo（直接发 SET_SIZE 让主进程立刻改窗口尺寸），
// 同时把宽/高框同步成正方形 BASE*scale，保证两套控件数值永远一致、不会漂移。
function applyScale(s) {
  s = Math.max(0.2, Math.min(5, s || 1));
  scaleInput.value = s;
  scaleVal.textContent = s.toFixed(2);
  const w = Math.round(BASE * s);
  wInput.value = w;
  hInput.value = w;
  api.send(CH.SET_SIZE, { width: w, height: w }); // 实时反馈，无需先保存
}
scaleInput.addEventListener('input', () => applyScale(parseFloat(scaleInput.value)));

// 宽/高数字框：反向同步回缩放滑块（始终正方形，以宽为准）
function applySizeFromWidth(w) {
  w = Math.max(80, Math.min(1200, parseInt(w, 10) || BASE));
  const s = w / BASE;
  scaleInput.value = s;
  scaleVal.textContent = s.toFixed(2);
  wInput.value = w;
  hInput.value = w;
  api.send(CH.SET_SIZE, { width: w, height: w });
}
wInput.addEventListener('input', () => applySizeFromWidth(wInput.value));
hInput.addEventListener('input', () => applySizeFromWidth(hInput.value));

// 「闲置默认模式」下拉：动态列出配置里的所有动画（含用户新增素材），
// 睡觉/到处走走固定排最前，其余按 states 顺序追加
function rebuildIdleModeOptions(cfg) {
  autoModeSel.innerHTML = '';
  const opts = [['sleep', '睡觉'], ['walk', '到处走走']];
  Object.keys(cfg.states || {}).forEach((k) => {
    if (opts.some(([v]) => v === k)) return;
    const st = cfg.states[k];
    if (!st || !st.video) return; // 没素材的状态不列出
    opts.push([k, st.label || k]);
  });
  opts.forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    autoModeSel.appendChild(o);
  });
}

// ---------- 专注控制（面板直达） ----------
// 「开始专注」带上滑块当前时长：拖了滑块不用先点保存也能按新时长开跑
$('focus-start').onclick = () => api.send(CH.PANEL_FOCUS_CMD, { cmd: 'start', min: parseInt(focusDur.value, 10) || undefined });
$('focus-toggle').onclick = () => api.send(CH.PANEL_FOCUS_CMD, 'pause');
$('focus-stop').onclick = () => api.send(CH.PANEL_FOCUS_CMD, 'stop');

function fmtRemain(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

api.onFocusState((st) => {
  if (!focusStatus) return;
  if (st.phase === 'running') focusStatus.textContent = '专注中 · 剩余 ' + fmtRemain(st.remainingSec);
  else if (st.phase === 'paused') focusStatus.textContent = '已暂停 · 剩余 ' + fmtRemain(st.remainingSec);
  else focusStatus.textContent = '未开始（时长 ' + st.durationMin + ' 分钟）';
});

// ---------- 配置进 / 出 ----------
function applyConfig(cfg) {
  working = cfg;
  clickTA.value = (cfg.clickResponses || []).join('\n');
  idleTA.value = (cfg.idleMessages || []).join('\n');
  // 以 scale 为唯一真值，宽高由它推导（始终正方形），避免两套控件数值漂移导致“改了没反应”
  const s = cfg.size.scale || 1;
  scaleInput.value = s;
  scaleVal.textContent = s.toFixed(2);
  const sz = Math.round(BASE * s);
  wInput.value = sz;
  hInput.value = sz;
  timeoutInput.value = (cfg.idle && cfg.idle.idleTimeoutMs) || 8000;
  // 先按配置里的全部动画重建下拉选项，再回填当前值（保存过的旧值不在列表也补上）
  rebuildIdleModeOptions(cfg);
  const mode = (cfg.idle && cfg.idle.autoMode) || 'sleep';
  if (![...autoModeSel.options].some((o) => o.value === mode)) {
    const o = document.createElement('option');
    o.value = mode; o.textContent = mode;
    autoModeSel.appendChild(o);
  }
  autoModeSel.value = mode;
  deepSleepSecInput.value = (cfg.idle && cfg.idle.deepSleepSec) || 0;
  deepSleepStateSel.value = (cfg.idle && cfg.idle.deepSleepState) || 'lying_back';
  idleWalkMinInput.value = (cfg.idle && cfg.idle.idleWalkMin) || 0;
  autoStartEl.checked = !!cfg.autoStart;

  const f = cfg.focus || {};
  focusDur.value = f.durationMin || 25;
  focusDurVal.textContent = (f.durationMin || 25) + ' 分钟';
  focusAutorun.checked = !!f.autoRun;
  focusStrict.checked = !!f.strictMode;

  const w = cfg.water || {};
  waterEnabled.checked = !!w.enabled;
  waterInterval.value = w.intervalMin || 40;

  const sd = cfg.sound || {};
  soundEnabled.checked = sd.ringtone !== false;
  soundTone.value = sd.tone || 'glass';
  soundVibrate.checked = !!sd.vibrate;

  const rb = cfg.reminderBehavior || {};
  rbAction.checked = rb.doAction !== false;
  rbActionName.value = rb.action || 'cheer';
  rbBubble.checked = rb.showBubble !== false;
  rbPin.value = (rb.pinDurationSec != null) ? rb.pinDurationSec : 5;
  bubbleFont.value = rb.bubbleFontSize || 14;
  bubbleFontVal.textContent = (rb.bubbleFontSize || 14) + ' px';
  bubbleDuration.value = (rb.bubbleDurationSec != null) ? rb.bubbleDurationSec : 6;

  buildAssetList();
  buildPhraseList();
  buildFoodList();
  renderSchedules();
}

$('save').onclick = () => {
  collectPhrases();
  const cfg = {
    version: 1,
    autoStart: autoStartEl.checked,
    size: {
      scale: parseFloat(scaleInput.value) || 1,
      width: parseInt(wInput.value, 10) || BASE,
      height: parseInt(hInput.value, 10) || BASE
    },
    idle: {
      autoMode: autoModeSel.value,
      idleTimeoutMs: parseInt(timeoutInput.value, 10) || 8000,
      deepSleepSec: parseInt(deepSleepSecInput.value, 10) || 0,
      deepSleepState: deepSleepStateSel.value,
      idleWalkMin: parseInt(idleWalkMinInput.value, 10) || 0
    },
    states: working.states,
    clickResponses: splitLines(clickTA.value),
    idleMessages: splitLines(idleTA.value),
    focus: {
      durationMin: parseInt(focusDur.value, 10) || 25,
      autoRun: focusAutorun.checked,
      strictMode: focusStrict.checked
    },
    water: {
      enabled: waterEnabled.checked,
      intervalMin: parseInt(waterInterval.value, 10) || 40
    },
    sound: {
      ringtone: soundEnabled.checked,
      tone: soundTone.value,
      vibrate: soundVibrate.checked
    },
    reminderBehavior: {
      doAction: rbAction.checked,
      action: rbActionName.value,
      showBubble: rbBubble.checked,
      pinDurationSec: parseInt(rbPin.value, 10) || 5,
      bubbleFontSize: parseInt(bubbleFont.value, 10) || 14,
      bubbleDurationSec: parseInt(bubbleDuration.value, 10) || 6
    },
    foods: working.foods || [],
    schedules: working.schedules || []
  };
  api.send(CH.SAVE_CONFIG, cfg);
  hint.textContent = '已保存，桌宠已同步';
};

$('restore').onclick = () => {
  api.send(CH.RESET_DEFAULT);
  hint.textContent = '已恢复默认';
};

api.onPanelConfig(applyConfig);
api.send(CH.REQUEST_CONFIG);
