// IPC 通道常量，主进程与渲染进程共用，避免拼写不一致
module.exports = {
  CONFIG_UPDATED: 'main:config-updated',
  REQUEST_CONFIG: 'panel:request-config',
  CONFIG_FOR_PANEL: 'main:config-for-panel',
  SAVE_CONFIG: 'panel:save-config',
  UPLOAD_ASSET: 'panel:upload-asset',
  UPLOAD_FOOD_ICON: 'panel:upload-food-icon',
  ASSET_URL: 'panel:asset-url',
  RESET_DEFAULT: 'panel:reset-default',
  GET_BOUNDS: 'pet:get-bounds',
  SET_BOUNDS: 'pet:set-bounds',
  GET_SCREEN: 'pet:get-screen',
  SET_SIZE: 'pet:set-size',
  TOGGLE_PANEL: 'pet:toggle-panel',
  PET_CONTEXT_MENU: 'pet:context-menu',    // 桌宠 → 主进程：请求弹出右键菜单（携带光标屏幕坐标）
  PET_MENU_CMD: 'pet:menu-cmd',            // 主进程 → 桌宠：菜单选中的动作（喂食/睡觉等渲染端行为）
  // 自建右键菜单窗口（替代原生 Menu.popup，避免透明/置顶窗口下原生菜单不弹出的问题）
  MENU_ITEMS: 'menu:items',                // 主进程 → 菜单窗口：下发菜单树
  MENU_CLOSE: 'menu:close',                // 主进程 → 菜单窗口：关闭
  MENU_PICK: 'pet:menu-pick',              // 菜单窗口 → 主进程：选中某项（{action,arg}）
  MENU_SIZE: 'menu:size',                  // 菜单窗口 → 主进程：内容高度，用于自适应窗口尺寸
  // 专注 & 日程提醒
  REMINDER_EVENT: 'main:reminder-event',   // 主进程 → 桌宠：提醒触发
  // 独立气泡窗口：气泡画在桌宠窗口外的独立置顶小窗里，悬浮在 lolo 头顶，
  // 彻底避免 240x240 小窗内气泡必然压在 lolo 身上的问题
  BUBBLE_SHOW: 'pet:bubble-show',          // 桌宠 → 主进程：请求显示气泡 {kind,text,title}
  BUBBLE_HIDE: 'pet:bubble-hide',          // 桌宠 → 主进程：隐藏气泡
  BUBBLE_CONTENT: 'bubble:content',        // 主进程 → 气泡窗口：渲染内容
  BUBBLE_SIZE: 'bubble:size',              // 气泡窗口 → 主进程：内容尺寸，用于自适应窗口
  BUBBLE_DISMISSED: 'bubble:dismissed',    // 主进程 → 桌宠：气泡被点击关闭（提醒用）
  FOCUS_STATE: 'main:focus-state',         // 主进程 → 桌宠/面板：番茄钟状态广播
  FOCUS_CMD: 'pet:focus-cmd',              // 桌宠 → 主进程：右键快捷 暂停/继续/结束
  PANEL_FOCUS_CMD: 'panel:focus-cmd',      // 面板 → 主进程：开始/暂停/继续/结束
  // 自动更新（electron-updater + Cloudflare R2 / generic）
  UPDATE_AVAILABLE: 'main:update-available', // 主进程 → 桌宠：发现新版本 {version}
  UPDATE_PROGRESS: 'main:update-progress',   // 主进程 → 桌宠：下载进度 {percent}
  UPDATE_DOWNLOADED: 'main:update-downloaded', // 主进程 → 桌宠：下载完成，可重启安装
  UPDATE_CMD: 'pet:update-cmd',              // 桌宠 → 主进程：{cmd:'download'|'install'|'dismiss'}
  UPDATE_CHECK: 'pet:update-check',          // 桌宠 → 主进程：手动检查更新（右键菜单）
  UPDATE_STATUS: 'main:update-status',       // 主进程 → 面板：更新状态文本
  DEBUG_LOG: 'app:debug-log'               // 渲染进程 → 主进程：诊断日志
};
