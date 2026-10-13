// 安全桥接：只暴露受控 API，不泄露 Node 能力
// 注意：本文件刻意“自包含”，不 require 任何本地 .js 模块 ——
// 否则在 Electron 沙箱(default)下 require 本地文件会静默失败，导致整个 preload 不执行、
// window.loloAPI 永不注入、桌宠与面板全部失效。
const { contextBridge, ipcRenderer } = require('electron');

// 与 src/shared/ipcChannels.js 保持一致的通道常量（内联，避免跨模块依赖）
const CH = {
  CONFIG_UPDATED: 'main:config-updated',
  REQUEST_CONFIG: 'panel:request-config',
  CONFIG_FOR_PANEL: 'main:config-for-panel',
  SAVE_CONFIG: 'panel:save-config',
  UPLOAD_ASSET: 'panel:upload-asset',
  UPLOAD_FOOD_ICON: 'panel:upload-food-icon',
  PICK_FILE: 'panel:pick-file',
  ASSET_URL: 'panel:asset-url',
  RESET_DEFAULT: 'panel:reset-default',
  GET_BOUNDS: 'pet:get-bounds',
  SET_BOUNDS: 'pet:set-bounds',
  GET_SCREEN: 'pet:get-screen',
  SET_SIZE: 'pet:set-size',
  TOGGLE_PANEL: 'pet:toggle-panel',
  PET_CONTEXT_MENU: 'pet:context-menu',
  PET_MENU_CMD: 'pet:menu-cmd',
  MENU_ITEMS: 'menu:items',
  MENU_CLOSE: 'menu:close',
  MENU_PICK: 'pet:menu-pick',
  MENU_SIZE: 'menu:size',
  REMINDER_EVENT: 'main:reminder-event',
  BUBBLE_SHOW: 'pet:bubble-show',
  BUBBLE_HIDE: 'pet:bubble-hide',
  BUBBLE_CONTENT: 'bubble:content',
  BUBBLE_SIZE: 'bubble:size',
  BUBBLE_DISMISSED: 'bubble:dismissed',
  FOCUS_STATE: 'main:focus-state',
  FOCUS_CMD: 'pet:focus-cmd',
  PANEL_FOCUS_CMD: 'panel:focus-cmd',
  // 自动更新
  UPDATE_AVAILABLE: 'main:update-available',
  UPDATE_PROGRESS: 'main:update-progress',
  UPDATE_DOWNLOADED: 'main:update-downloaded',
  UPDATE_CMD: 'pet:update-cmd',
  UPDATE_CHECK: 'pet:update-check',
  UPDATE_STATUS: 'main:update-status',
  DEBUG_LOG: 'app:debug-log'
};

contextBridge.exposeInMainWorld('loloAPI', {
  channels: CH,
  onConfig: (cb) => ipcRenderer.on(CH.CONFIG_UPDATED, (e, cfg) => cb(cfg)),
  onPanelConfig: (cb) => ipcRenderer.on(CH.CONFIG_FOR_PANEL, (e, cfg) => cb(cfg)),
  onReminder: (cb) => ipcRenderer.on(CH.REMINDER_EVENT, (e, payload) => cb(payload)),
  onPetMenu: (cb) => ipcRenderer.on(CH.PET_MENU_CMD, (e, action) => cb(action)),
  onMenuItems: (cb) => ipcRenderer.on(CH.MENU_ITEMS, (e, items) => cb(items)),
  onMenuClose: (cb) => ipcRenderer.on(CH.MENU_CLOSE, () => cb()),
  onFocusState: (cb) => ipcRenderer.on(CH.FOCUS_STATE, (e, st) => cb(st)),
  // 注意：必须把 payload 透传给回调，否则接收方拿不到 kind，
  // 无法区分「提醒气泡/更新气泡/日常说话气泡」被点击（此前遗漏导致提醒点击不结束提醒）
  onBubbleDismissed: (cb) => ipcRenderer.on(CH.BUBBLE_DISMISSED, (e, p) => cb(p)),
  onBubbleContent: (cb) => ipcRenderer.on(CH.BUBBLE_CONTENT, (e, p) => cb(p)),
  onUpdateAvailable: (cb) => ipcRenderer.on(CH.UPDATE_AVAILABLE, (e, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on(CH.UPDATE_PROGRESS, (e, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on(CH.UPDATE_DOWNLOADED, (e, info) => cb(info)),
  send: (ch, data) => ipcRenderer.send(ch, data),
  // 面板切换语言下拉时即时上报，让托盘菜单/右键菜单/气泡立刻跟上（不必等保存）
  setLang: (lang) => ipcRenderer.send(CH.SET_LANG, lang),
  invoke: (ch, data) => ipcRenderer.invoke(ch, data),
  readAsset: (url) => ipcRenderer.invoke('pet:read-asset', url)
});

// 捕获页面脚本错误并转发到主进程日志，便于排查桌宠/面板 JS 崩溃（如 loloAPI 缺失）
function __reportErr(tag, info) { try { ipcRenderer.send('app:debug-log', tag + ': ' + info); } catch (e) {} }
window.addEventListener('error', (e) => __reportErr('PAGE-ERROR', (e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', (e) => __reportErr('REJECTION', (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)));

// 禁止页面手势缩放（捏合 / Ctrl+滚轮），避免触控板或某些鼠标把 lolo 越放越大
function __blockPageZoom() {
  const stop = (e) => { e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => {
    window.addEventListener(t, stop, { passive: false });
  });
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}
__blockPageZoom();

// 确认 preload 成功执行（若 startup.log 出现此行，说明桥接已注入）
try { ipcRenderer.send('app:debug-log', 'preload loaded OK'); } catch (e) {}
