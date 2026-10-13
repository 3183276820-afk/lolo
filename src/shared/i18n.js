/**
 * lolo 桌宠 —— 双语（中文 / 英文）国际化模块
 *
 * 双模式导出：
 *   主进程（CommonJS）: const I18N = require('./src/shared/i18n')
 *   渲染进程（<script>）: window.LoloI18n
 *
 * 语言决策优先级：用户在面板显式选择 > 跟随系统语言 > 中文兜底
 */
(function (root) {
  'use strict';

  // ============ 界面文案 ============
  const ZH = {
    // 错误与提示
    'err.startupTitle': 'lolo 启动出错',
    'err.runtimeTitle': 'lolo 运行出错',
    'err.windowCrash': '桌宠窗口崩溃',
    'msg.firstRun': '首次启动，已为你打开控制面板',

    // 托盘
    'tray.openPanel': '打开控制面板',
    'tray.quit': '退出 lolo',
    'tray.tooltip': 'lolo 桌宠 v',

    // 文件选择
    'dialog.selectFile': '选择文件',
    'dialog.images': '图片',
    'dialog.videos': '视频',

    // 桌宠右键菜单
    'menu.sleep': '睡觉',
    'menu.walk': '到处走走',
    'menu.idleDefault': '恢复默认待机',
    'menu.upsideDown': '倒立',
    'menu.cheer': '加油',
    'menu.turn': '转身',
    'menu.feed': '喂食',
    'menu.pausePomodoro': '暂停番茄钟',
    'menu.stopFocus': '结束专注',
    'menu.resumePomodoro': '继续番茄钟',
    'menu.startPomodoro': '开始番茄钟',
    'menu.openPanel': '控制面板',
    'unit.minutes': ' 分钟',
    'unit.minutesShort': '分钟',
    'unit.seconds': '秒',
    'suffix.default': '（默认）',

    // 提醒通知
    'notify.focusAborted.title': '专注终止',
    'notify.focusAborted.body': '严格模式下暂停会结束本轮专注，重新开始吧~',
    'notify.schedule.title': '日程提醒',
    'notify.schedule.body': '提醒：',
    'notify.schedule.defaultTitle': '日程事项',
    'notify.focusDone.title': '专注完成！',
    'notify.focusDone.body': '一轮专注结束，休息一下吧~',
    'notify.water.title': '喝水提醒',
    'notify.water.body': '记得喝水哦~',

    // 更新
    'updater.foundTitle': '发现新版本 v',
    'updater.macGuideHint': '点击前往 GitHub 下载新版 dmg',
    'updater.openDownload': '点击打开下载页',
    'updater.newVersionText': 'lolo 有新版本啦，点击即可下载更新',
    'updater.clickDownload': '点击下载更新',
    'updater.downloading': '正在下载更新',
    'updater.preparing': '准备中…',
    'updater.progress': '已完成 ',
    'updater.downloadHint': '下载中，请稍候…',
    'updater.readyTitle': '更新已就绪 v',
    'updater.readyText': '点击立即重启并安装新版本',
    'updater.clickInstall': '点击安装并重启',

    // 面板
    'panel.title': 'lolo 桌宠控制面板',
    'panel.sub': '管理桌宠窗口的素材、互动回应、专注与日程提醒。修改保存后会实时同步。',
    'tab.assets': '素材管理',
    'tab.interaction': '互动设置',
    'tab.focus': '专注 & 日程提醒',
    'card.assetList': '素材列表',
    'hint.assets': '点击「上传/更换」为对应状态绑定视频素材，保存后实时生效',
    'card.interactionText': '互动文案',
    'label.clickResponses': '随机回应（点击 lolo 时触发，每行一条）',
    'label.idleMessages': '闲置消息（长时间无交互时触发，每行一条）',
    'card.actionLines': '动作台词（不同动作对应相应的语句）',
    'hint.actionLines': 'lolo 做某个动作时会优先说这里配置的专属台词，每行一条；留空则使用上面的通用语句',
    'card.autoStart': '开机自启',
    'label.autoStart': '开机自动运行 lolo',
    'hint.autoStart': '开启后，登录时会自动启动桌宠（Windows 在「启动」文件夹放入快捷方式）',
    'card.foods': '喂食食物',
    'btn.addFood': '＋ 新增食物',
    'hint.foods': '右键 lolo → 喂食，会弹出这里配置的食物列表。每种食物需要一个透明 PNG 图标（放在 assets/videos/ 或用下方「上传图标」）。',
    'label.foodName': '名称',
    'label.foodIcon': '图标',
    'btn.uploadReplace': '上传/更换',
    'btn.uploadIcon': '上传图标',
    'btn.remove': '删除',
    'card.size': '桌宠尺寸',
    'label.scale': '缩放',
    'label.width': '宽度(px)',
    'label.height': '高度(px)',
    'label.idleTimeout': '闲置超时(ms)',
    'label.autoMode': '闲置默认模式',
    'option.sleep': '睡觉',
    'option.walk': '到处走走',
    'label.deepSleepSec': '深度睡眠(秒)',
    'label.deepSleepState': '深度睡眠动作',
    'option.lyingBack': '仰躺并定格',
    'option.sleepNoRoll': '趴着睡(不翻身)',
    'label.idleWalkMin': '自动散步(分钟，0=关闭)',
    'btn.restore': '恢复默认',
    'card.focusTimer': '专注计时',
    'label.focusDuration': '专注工作时长',
    'label.focusAutoRun': '一轮结束自动开启下一段计时',
    'label.focusStrict': '启用严格模式：暂停计时直接终止本轮专注',
    'focus.statusIdle': '未开始',
    'focus.statusRunning': '专注中',
    'focus.statusPaused': '已暂停',
    'btn.focusStart': '开始专注',
    'btn.focusToggle': '暂停 / 继续',
    'btn.focusStop': '结束',
    'card.water': '周期性自定义提醒',
    'label.waterEnabled': '定时喝水提醒',
    'label.waterInterval': '提醒间隔',
    'unit.minutesEach': '分钟一次',
    'card.sound': '提醒音效',
    'label.soundEnabled': '播放提醒铃声',
    'label.soundTone': '铃声',
    'tone.chime': '清脆',
    'tone.soft': '柔和',
    'label.soundVibrate': '震动反馈（lolo 抖动）',
    'card.petBehavior': 'lolo 提醒表现',
    'label.rbAction': '触发时切换专属提醒动作',
    'option.drink': '喝水',
    'option.cheer': '加油',
    'option.upsideDown': '倒立',
    'label.rbBubble': '弹出文字气泡框展示提醒内容',
    'label.rbPin': '置顶显示持续',
    'unit.secThenNormal': '秒后恢复常态',
    'card.bubbleStyle': '气泡样式',
    'label.bubbleFont': '气泡文字字体大小',
    'label.bubbleDuration': '气泡自动消失时长',
    'card.schedules': '日程事项提前提醒',
    'btn.addSchedule': '＋ 新增日程',
    'hint.schedules': '支持一次性 / 每周工作日 / 每天重复；到点前可提前提醒（如提前 30 分钟）',
    'btn.save': '保存',
    'btn.cancel': '取消',
    'btn.confirm': '确定',
    'msg.saved': '已保存并同步',
    'label.language': '界面语言',
    'option.langAuto': '跟随系统',
    'option.langZh': '简体中文',
    'option.langEn': 'English',
    'card.language': '语言 Language',
    'hint.language': '切换后立即生效；「跟随系统」会按操作系统语言自动选择',
    'btn.openHelp': '使用说明',
    'help.title': 'lolo 桌宠使用说明',

    // 日程
    'schedule.label.title': '事项名称',
    'schedule.label.time': '时间',
    'schedule.label.lead': '提前提醒(分钟)',
    'schedule.repeat.once': '一次性',
    'schedule.repeat.weekday': '每周工作日',
    'schedule.repeat.daily': '每天',
    'schedule.type.once': '一次性日程',
    'schedule.type.daily': '每天重复',
    'schedule.type.weekday': '工作日重复',

    // 动态生成的界面文本
    'asset.notSet': '（未设置）',
    'asset.uploadedHint': '素材已上传，桌宠实时同步',
    'phrase.placeholder': '每行一条，留空使用通用语句',
    'food.noIcon': '无',
    'food.namePlaceholder': '食物名称',
    'food.empty': '暂无食物，点击右上角「＋ 新增食物」添加一种',
    'food.newName': '新食物',
    'schedule.titlePlaceholder': '事项标题，如：项目会议',
    'schedule.execTime': '执行时间',
    'schedule.repeatLabel': '重复',
    'schedule.leadLabel': '提前',
    'schedule.onTime': '准时',
    'schedule.custom': '自定义',
    'schedule.empty': '暂无日程，点击右上角「＋ 新增日程」添加一条提醒事项',
    'focus.statusRunningText': '专注中 · 剩余 ',
    'focus.statusPausedText': '已暂停 · 剩余 ',
    'focus.statusIdleText': '未开始（时长 ',
    'msg.restored': '已恢复默认',
    'asset.walkRight': '到处走走(右)',
    'asset.walkLeft': '到处走走(左)',
    'asset.turnClick': '转身(右键触发)',
    'asset.grabTip': '被拎起(拖拽时)',
    'asset.dropTip': '被放下(松手时)',
    'asset.rollOver': '翻身(深睡过渡)',
    'asset.lyingBack': '仰躺(深睡定格)',
    'asset.focusStart': '番茄钟启动',
    'asset.dazeTip': '打瞌睡(专注待机)',
    'asset.readTip': '看书(专注待机)',

    // ---- 桌宠本体的界面文案（src/pet/pet.js） ----
    'pet.loadFailed': 'lolo 加载失败：preload 未注入',
    'pet.preloadMissing': '[lolo] window.loloAPI 未定义：preload 未注入，桌宠无法运行',
    'pet.noFood': '暂未配置食物，请在面板「互动设置 → 喂食食物」里添加',
    'pet.wheelHint': '滚轮 / 拖动旋转 · 上方半圆每次显示 5 种',
    'pet.focusElapsed': '已专注 ',
    'pet.reminderTitle': '提醒',
    'pet.started': 'lolo 已启动 ✅',
    'pet.configSynced': '配置已同步',
    'pet.bubbleTitle': '提醒',
    'pet.bubbleHint': '点击关闭',
    'menu.back': '‹ 返回',

    // ---- 应用内「使用说明」 ----
    'tab.help': '使用说明',
    'help.title': 'lolo 桌宠 · 使用说明',
    'help.sub': '按「从上手到进阶」介绍 lolo 的全部功能，遇到问题请先看最后一节。所有设置在保存后立刻生效，无需重启。',
    'help.start.t': '一、启动与托盘',
    'help.start.d': '双击 lolo 桌宠.exe 启动，lolo 会出现在屏幕右下角。\n程序没有主窗口，只保留托盘图标；找不到时请点任务栏的「∧」展开隐藏图标区。\n鼠标悬停托盘图标可看到当前版本号（如 v1.0.2），方便确认是否已是最新版。\n托盘右键可选择「打开面板 / 喂食 / 恢复默认待机 / 退出」。',
    'help.move.t': '二、移动与互动',
    'help.move.d': '按住 lolo 拖动即可把它放到屏幕任意位置，松手会播放「放下」的小动画。\n单击 lolo：它会随机说一句话（互动文案可在面板里自定义）。\n拖拽时被「拎起」，会有专门的拎起姿势和台词。\n长时间不理它，lolo 会自己睡觉；睡久了还会翻个身仰躺。',
    'help.menu.t': '三、右键菜单',
    'help.menu.d': '在 lolo 上点右键会弹出菜单（悬浮跟随光标，不遮挡 lolo）：\n① 打开面板 —— 进入所有设置。\n② 喂食 —— 弹出轮子/列表选择食物，投喂后会播放吃食动画。\n③ 番茄钟 —— 直接选择 15 / 25 / 45 / 60 分钟开始专注。\n④ 恢复默认待机 —— 专注重回到「看书/打瞌睡」循环，平时回到面板设定的闲置模式。\n⑤ 到处走走 / 睡觉 / 倒立 / 打气 等动作。\n⑥ 退出 —— 彻底关闭程序。',
    'help.feed.t': '四、喂食',
    'help.feed.d': '默认有 10 种食物（蛋糕、汉堡、鸡块、鸡腿、煎蛋、可乐、奶茶、牛奶、寿司、薯条）。\n在面板「互动设置 → 喂食食物」里可以添加、删除食物，或用「上传图标」换成自己的图片（建议透明背景 PNG）。\n食物超过 5 种时，喂食面板会变成一个可旋转的轮盘：滚动鼠标滚轮或拖动即可转动，上半圆始终露出 5 种。\n若某项食物的图标缺失，投喂时会自动跳过，不会报错。',
    'help.pomodoro.t': '五、番茄钟专注',
    'help.pomodoro.d': '在右键菜单里选时长即可开始专注，lolo 会先弯腰看地上的小计时器、再起身为你加油。\n专注期间 lolo 会在「看书」和「打瞌睡」之间随机切换，桌宠身上会显示已专注的时长。\n专注中单击 lolo，它会对你说鼓励的话（加油语可自定义）。\n时间到会有提醒气泡；专注结束后自动回到日常状态。\n默认时长、提醒动作、气泡显示时长等都可以在面板「专注 & 日程提醒」里设置。',
    'help.reminder.t': '六、喝水提醒与日程提醒',
    'help.reminder.d': '喝水提醒：设置一个间隔（如每 40 分钟），到点 lolo 会播放喝水动画并弹出气泡。\n日程提醒：在面板里添加具体时间与重复方式（一次性 / 每天 / 工作日），还能设置提前预告时间。\n提醒气泡可以点击关闭；不点也会在设定秒数后自动消失。\n提醒期间 lolo 会表演对应动作（面板里可开关），例如日程提醒默认播「加油」。\n注意：提醒不会打断你对 lolo 的手动操作，表演结束后继续正常的闲置计时。',
    'help.settings.t': '七、面板设置',
    'help.settings.d': '面板分三个标签页：\n① 素材管理 —— 桌宠大小（缩放）、各动作素材文件、闲置默认模式与深度睡眠时间。\n② 互动设置 —— 界面语言、点击回应、闲置话语、喂食食物清单。\n③ 专注 & 日程提醒 —— 番茄钟时长、喝水提醒间隔、日程列表、提醒动作与气泡显示时长。\n所有改动要点「保存」才会写入；保存后桌宠与提醒会立即按新配置运行。',
    'help.lang.t': '八、切换语言（中文 / English）',
    'help.lang.d': '面板「互动设置」页最上方有「语言 Language」下拉：\n① 跟随系统 —— 系统语言为中文时显示中文，其他语言显示 English。\n② 简体中文 / English —— 手动强制指定。\n切换后立即生效，托盘菜单、气泡、面板、桌宠提示同步变化。\n内置的食物名、状态台词、点击回应也会一并翻译；但这些只翻译「你没改过」的项，自己改过的名字和台词会原样保留，不会被覆盖。',
    'help.update.t': '九、获取更新',
    'help.update.d': 'Windows 安装版：发现新版本会弹出气泡，点击下载，下完再点一次即可安装重启（自动更新，无需手动下载）。\nWindows 便携版：按设计不参与自动更新，需要到发布页下载新版本替换。\nmacOS：检测到新版本会弹气泡引导前往下载页，下载 dmg 后重新拖入 Applications 覆盖安装。\nWindows 7 用户：请使用专门的 lolo-win7-*.exe 版本。',
    'help.trouble.t': '十、常见问题',
    'help.trouble.d': '① 桌宠不见了：多为缩放到屏幕外或显示比例变化导致。右键托盘 → 退出，重新启动即可回到默认位置。\n② 拖到一半越变越大：已修复。若再次出现，请确认版本号不低于 v1.0.1。\n③ 上传食物图标没反应：必须点面板里的「上传图标」按钮走文件选择框；直接把图片丢进文件夹无效。\n④ 面板里改了没反应：改动要点「保存」才会同步给桌宠。\n⑤ Mac 提示「无法验证开发者」：右键应用图标 → 打开；或在终端执行 xattr -cr /Applications/lolo桌宠.app。\n⑥ Win7 打不开：需安装 Win7 SP1、KB2999226 与 VC++ 2015-2022 运行库，并使用 win7 专版。\n⑦ 看不到动画：请确认 assets/videos 下的素材文件完整。'
  };

  const EN = {
    'err.startupTitle': 'lolo Failed to Start',
    'err.runtimeTitle': 'lolo Runtime Error',
    'err.windowCrash': 'Pet Window Crashed',
    'msg.firstRun': 'First launch — the control panel is open for you',

    'tray.openPanel': 'Open Control Panel',
    'tray.quit': 'Quit lolo',
    'tray.tooltip': 'lolo Desktop Pet v',

    'dialog.selectFile': 'Select File',
    'dialog.images': 'Images',
    'dialog.videos': 'Videos',

    'menu.sleep': 'Sleep',
    'menu.walk': 'Walk Around',
    'menu.idleDefault': 'Back to Idle',
    'menu.upsideDown': 'Handstand',
    'menu.cheer': 'Cheer',
    'menu.turn': 'Turn Around',
    'menu.feed': 'Feed',
    'menu.pausePomodoro': 'Pause Pomodoro',
    'menu.stopFocus': 'End Focus',
    'menu.resumePomodoro': 'Resume Pomodoro',
    'menu.startPomodoro': 'Start Pomodoro',
    'menu.openPanel': 'Control Panel',
    'unit.minutes': ' min',
    'unit.minutesShort': 'min',
    'unit.seconds': 'sec',
    'suffix.default': ' (default)',

    'notify.focusAborted.title': 'Focus Session Terminated',
    'notify.focusAborted.body': 'In strict mode, pausing ends this session. Start a new one whenever you\'re ready ~',
    'notify.schedule.title': 'Schedule Reminder',
    'notify.schedule.body': 'Reminder: ',
    'notify.schedule.defaultTitle': 'Scheduled Item',
    'notify.focusDone.title': 'Focus Complete!',
    'notify.focusDone.body': 'Session finished — take a short break ~',
    'notify.water.title': 'Hydration Reminder',
    'notify.water.body': 'Time to drink some water ~',

    'updater.foundTitle': 'New version v',
    'updater.macGuideHint': 'Click to open GitHub and download the new dmg',
    'updater.openDownload': 'Click to open download page',
    'updater.newVersionText': 'A new lolo version is available — click to download the update',
    'updater.clickDownload': 'Click to download update',
    'updater.downloading': 'Downloading update',
    'updater.preparing': 'Preparing…',
    'updater.progress': 'Completed ',
    'updater.downloadHint': 'Downloading, please wait…',
    'updater.readyTitle': 'Update ready v',
    'updater.readyText': 'Click to restart and install the new version',
    'updater.clickInstall': 'Click to install and restart',

    'panel.title': 'lolo Desktop Pet — Control Panel',
    'panel.sub': 'Manage animations, interaction replies, the focus timer and reminders. Changes sync instantly after saving.',
    'tab.assets': 'Media',
    'tab.interaction': 'Interaction',
    'tab.focus': 'Focus & Reminders',
    'card.assetList': 'Animation Assets',
    'hint.assets': 'Click "Upload/Replace" to bind a video to each state. Takes effect after saving.',
    'card.interactionText': 'Interaction Texts',
    'label.clickResponses': 'Random replies (one per line, triggered when you click lolo)',
    'label.idleMessages': 'Idle messages (one per line, after a while with no interaction)',
    'card.actionLines': 'Action lines (one set per action)',
    'hint.actionLines': 'lolo says these lines first for each action, one per line; leave empty to fall back to the general lines above',
    'card.autoStart': 'Launch at Login',
    'label.autoStart': 'Start lolo automatically at login',
    'hint.autoStart': 'When enabled, lolo launches at login (on Windows a shortcut is added to the Startup folder)',
    'card.foods': 'Foods',
    'btn.addFood': '＋ Add Food',
    'hint.foods': 'Right-click lolo → Feed to show this food list. Each food needs a transparent PNG icon (place it in assets/videos/ or use "Upload icon" below).',
    'label.foodName': 'Name',
    'label.foodIcon': 'Icon',
    'btn.uploadReplace': 'Upload/Replace',
    'btn.uploadIcon': 'Upload icon',
    'btn.remove': 'Remove',
    'card.size': 'Pet Size',
    'label.scale': 'Scale',
    'label.width': 'Width (px)',
    'label.height': 'Height (px)',
    'label.idleTimeout': 'Idle timeout (ms)',
    'label.autoMode': 'Default idle mode',
    'option.sleep': 'Sleep',
    'option.walk': 'Walk around',
    'label.deepSleepSec': 'Deep sleep (sec)',
    'label.deepSleepState': 'Deep sleep pose',
    'option.lyingBack': 'Lying on back (frozen)',
    'option.sleepNoRoll': 'Lying down (no roll over)',
    'label.idleWalkMin': 'Auto walk (min, 0 = off)',
    'btn.restore': 'Restore Defaults',
    'card.focusTimer': 'Focus Timer',
    'label.focusDuration': 'Focus length',
    'label.focusAutoRun': 'Auto-start the next session when one ends',
    'label.focusStrict': 'Strict mode: pausing ends the current session',
    'focus.statusIdle': 'Not started',
    'focus.statusRunning': 'Focusing',
    'focus.statusPaused': 'Paused',
    'btn.focusStart': 'Start',
    'btn.focusToggle': 'Pause / Resume',
    'btn.focusStop': 'End',
    'card.water': 'Periodic Custom Reminders',
    'label.waterEnabled': 'Hydration reminder',
    'label.waterInterval': 'Interval',
    'unit.minutesEach': ' min each',
    'card.sound': 'Reminder Sound',
    'label.soundEnabled': 'Play ringtone',
    'label.soundTone': 'Ringtone',
    'tone.chime': 'Crisp',
    'tone.soft': 'Soft',
    'label.soundVibrate': 'Vibration feedback (lolo shakes)',
    'card.petBehavior': 'lolo Reminder Behavior',
    'label.rbAction': 'Switch to a dedicated reminder action',
    'option.drink': 'Drink',
    'option.cheer': 'Cheer',
    'option.upsideDown': 'Handstand',
    'label.rbBubble': 'Show reminder text in a bubble',
    'label.rbPin': 'Keep on top for',
    'unit.secThenNormal': ' sec, then back to normal',
    'card.bubbleStyle': 'Bubble Style',
    'label.bubbleFont': 'Bubble font size',
    'label.bubbleDuration': 'Bubble auto-dismiss after',
    'card.schedules': 'Upcoming Task Reminders',
    'btn.addSchedule': '＋ Add Task',
    'hint.schedules': 'Supports one-time / weekdays / daily repeat; reminders can fire in advance (e.g. 30 minutes before)',
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.confirm': 'OK',
    'msg.saved': 'Saved and synced',
    'label.language': 'Language',
    'option.langAuto': 'Follow system',
    'option.langZh': '简体中文',
    'option.langEn': 'English',
    'card.language': 'Language',
    'hint.language': 'Applies immediately; "Follow system" picks the language from your OS',
    'btn.openHelp': 'User Guide',
    'help.title': 'lolo Desktop Pet — User Guide',

    'schedule.label.title': 'Task name',
    'schedule.label.time': 'Time',
    'schedule.label.lead': 'Remind early (min)',
    'schedule.repeat.once': 'One-time',
    'schedule.repeat.weekday': 'Every weekday',
    'schedule.repeat.daily': 'Every day',
    'schedule.type.once': 'One-time task',
    'schedule.type.daily': 'Repeats daily',
    'schedule.type.weekday': 'Repeats on weekdays',

    'asset.notSet': ' (not set)',
    'asset.uploadedHint': 'Asset uploaded, pet synced',
    'phrase.placeholder': 'One per line; leave empty to use the general lines',
    'food.noIcon': 'None',
    'food.namePlaceholder': 'Food name',
    'food.empty': 'No foods yet — click "＋ Add Food" in the top right to add one',
    'food.newName': 'New Food',
    'schedule.titlePlaceholder': 'Task title, e.g. Project meeting',
    'schedule.execTime': 'Time',
    'schedule.repeatLabel': 'Repeat',
    'schedule.leadLabel': 'Early by',
    'schedule.onTime': 'On time',
    'schedule.custom': 'Custom',
    'schedule.empty': 'No tasks yet — click "＋ Add Task" in the top right to add a reminder',
    'focus.statusRunningText': 'Focusing · ',
    'focus.statusPausedText': 'Paused · ',
    'focus.statusIdleText': 'Not started · ',
    'msg.restored': 'Restored to defaults',
    'asset.walkRight': 'Walk Around (Right)',
    'asset.walkLeft': 'Walk Around (Left)',
    'asset.turnClick': 'Turn Around (right-click)',
    'asset.grabTip': 'Picked Up (while dragging)',
    'asset.dropTip': 'Put Down (on release)',
    'asset.rollOver': 'Roll Over (deep sleep)',
    'asset.lyingBack': 'Lying on Back (deep sleep)',
    'asset.focusStart': 'Pomodoro Start',
    'asset.dazeTip': 'Dozing Off (focus idle)',
    'asset.readTip': 'Reading (focus idle)',

    // ---- Pet window UI (src/pet/pet.js) ----
    'pet.loadFailed': 'lolo failed to load: preload not injected',
    'pet.preloadMissing': '[lolo] window.loloAPI undefined: preload missing, pet cannot run',
    'pet.noFood': 'No food configured. Add some in Panel → Interaction → Feed Foods',
    'pet.wheelHint': 'Scroll / drag to rotate · top half shows 5 at a time',
    'pet.focusElapsed': 'Focused ',
    'pet.reminderTitle': 'Reminder',
    'pet.started': 'lolo is ready ✅',
    'pet.configSynced': 'Settings synced',
    'pet.bubbleTitle': 'Reminder',
    'pet.bubbleHint': 'Click to close',
    'menu.back': '‹ Back',

    // ---- In-app User Guide ----
    'tab.help': 'User Guide',
    'help.title': 'lolo Desktop Pet · User Guide',
    'help.sub': 'Everything you need to know, from first launch to advanced settings. Settings apply immediately after saving — no restart needed. Trouble? Jump to the last section.',
    'help.start.t': '1. Launch & Tray Icon',
    'help.start.d': 'Double-click lolo桌宠.exe to launch; lolo appears at the bottom-right of your screen.\nThere is no main window — the app lives in the system tray. If you cannot find the icon, click the "∧" chevron on the taskbar to expand hidden icons.\nHover the tray icon to see the version number (e.g. v1.0.2) — handy to confirm you are up to date.\nRight-click the tray for: Open Panel / Feed / Restore Default Idle / Quit.',
    'help.move.t': '2. Move & Interact',
    'help.move.d': 'Drag lolo anywhere on screen; releasing plays a little "put down" animation.\nSingle click: lolo says something random (customize the lines in the panel).\nWhile dragging it is "picked up" — special pose and lines included.\nLeave it alone for a while and lolo falls asleep; after longer still, it rolls over onto its back.',
    'help.menu.t': '3. Right-click Menu',
    'help.menu.d': 'Right-click lolo for a floating native menu (follows the cursor, never covers lolo):\n① Open Panel — access all settings.\n② Feed — pick a food from the wheel/list; lolo plays an eating animation.\n③ Pomodoro — start focus for 15 / 25 / 45 / 60 minutes.\n④ Restore Default Idle — back to the Read/Daze loop while focusing, or your configured idle mode otherwise.\n⑤ Actions — Walk Around / Sleep / Handstand / Cheer, and more.\n⑥ Quit — close the app completely.',
    'help.feed.t': '4. Feeding',
    'help.feed.d': 'Ten foods ship by default (Cake, Burger, Nuggets, Drumstick, Fried Egg, Cola, Milk Tea, Milk, Sushi, Fries).\nIn Panel → Interaction → Feed Foods you can add or remove foods, or use Upload Icon to set your own image (transparent PNG recommended).\nWith more than 5 foods the picker becomes a rotating wheel: scroll the mouse wheel or drag to rotate — the top half always shows 5.\nA food whose icon file is missing is silently skipped when feeding — no error popup.',
    'help.pomodoro.t': '5. Pomodoro Focus',
    'help.pomodoro.d': 'Pick a duration in the right-click menu and lolo bends down to look at a little timer, then stands up to cheer for you.\nDuring focus lolo alternates between Reading and Dozing Off, and an elapsed timer shows on the pet.\nClick lolo mid-session for words of encouragement (lines are customizable).\nA bubble notification fires when time is up, then lolo returns to its normal routine.\nDefault duration, reminder action, and bubble duration are configurable under Panel → Focus & Reminders.',
    'help.reminder.t': '6. Water & Schedule Reminders',
    'help.reminder.d': 'Water reminder: set an interval (e.g. every 40 minutes) and lolo plays the drinking animation with a bubble.\nSchedule reminders: add a time and repeat rule (once / daily / weekdays) in the panel, with optional lead time.\nClick a reminder bubble to close it, or let it auto-dismiss after the configured seconds.\nlolo performs a matching action during the reminder (toggleable), e.g. Cheer for schedule reminders.\nReminders never interrupt your own interaction — the idle timer resumes normally afterwards.',
    'help.settings.t': '7. Panel Settings',
    'help.settings.d': 'The panel has three tabs:\n① Assets — pet size (scale), per-action asset files, default idle mode and deep-sleep delay.\n② Interaction — interface language, click responses, idle lines, food list.\n③ Focus & Reminders — Pomodoro length, water reminder interval, schedule list, reminder action and bubble duration.\nChanges take effect after you click Save; nothing needs restarting.',
    'help.lang.t': '8. Language (中文 / English)',
    'help.lang.d': 'At the top of Panel → Interaction there is a "Language 语言" dropdown:\n① Follow system — Chinese when the system locale is Chinese, English otherwise.\n② 简体中文 / English — force a specific language.\nSwitching applies instantly across the tray menu, bubbles, panel and pet.\nBuilt-in food names, state lines and click responses are translated too — but only those you have NOT edited. Your own custom names and lines are always preserved, never overwritten.',
    'help.update.t': '9. Getting Updates',
    'help.update.d': 'Windows installer: a bubble appears when a new version is found — click to download, click again to install and restart (fully automatic).\nWindows portable: by design it never auto-updates; download the new release manually.\nmacOS: a bubble guides you to the downloads page; drag the new dmg into Applications to replace.\nWindows 7 users: please use the dedicated lolo-win7-*.exe build.',
    'help.trouble.t': '10. Troubleshooting',
    'help.trouble.d': '① Pet disappeared: usually pushed off-screen by display scaling changes. Right-click tray → Quit and start again to reset its position.\n② Grows bigger when dragging: already fixed. If it recurs, make sure you are on v1.0.1 or later.\n③ Uploading a food icon does nothing: you must use the Upload Icon button in the panel. Dropping files into a folder has no effect.\n④ Panel changes have no effect: click Save to sync them to the pet.\n⑤ macOS says "cannot verify developer": right-click the app → Open, or run xattr -cr /Applications/lolo桌宠.app in Terminal.\n⑥ Won\'t start on Windows 7: install SP1, KB2999226 and the VC++ 2015-2022 runtime, and use the win7 build.\n⑦ No animations: make sure the asset files under assets/videos are present.'
  };

  // ============ 内置内容（状态标签/台词、食物名、互动文案） ============
  const CONTENT_ZH = {
    states: {
      sleep: { label: '睡觉', messages: ['Zzz……', '呼——呼——', '让 lolo 睡个好觉~'] },
      walk: { label: '到处走走', messages: ['溜达溜达~', '前面有什么好玩的？', '散步有助于消化哦'] },
      walk_left: { label: '到处走走(左)', messages: ['换个方向走走~', '往这边逛逛'] },
      turn: { label: '转身', messages: ['转个圈圈~', '看我灵活转身！'] },
      upside_down: { label: '倒立', messages: ['看我的倒立！', '世界颠倒啦~'] },
      grab: { label: '被拎起', messages: ['哇——放我下来！', '救命呀，我要飞起来了~'] },
      grab_held: { label: '被拎起(定格)' },
      drop: { label: '被放下', messages: ['哎哟，摔了个屁股蹲', '还是地上踏实~'] },
      cheer: { label: '加油', messages: ['加油加油！', '你最棒啦！', '冲鸭——'] },
      roll_over: { label: '翻身(深睡过渡)', messages: ['换个姿势睡更舒服~'] },
      lying_back: { label: '仰躺(深睡定格)', messages: ['四脚朝天，真放松…', 'Zzz……'] },
      feed: { label: '喂食', messages: ['好吃~', '谢谢投喂！', '好饱呀~', '嗯~真香'] },
      focus_start: { label: '番茄钟启动', messages: ['计时开始！我会陪着你的~', '看，小计时器已经在走啦', '专注模式，启动！'] },
      drink: { label: '喝水', messages: ['咕咚咕咚~补充水分！', '喝水时间到啦', '多喝水，皮肤好~'] },
      daze: { label: '打瞌睡', messages: ['困了……眼皮在打架', 'Zzz……（专注也要偷个懒）', '再撑一下下就好~'] },
      read: { label: '看书', messages: ['安静看会儿书~', '知识就是力量！', '翻一页，再翻一页'] }
    },
    foods: {
      cake: '蛋糕', burger: '汉堡', nuggets: '鸡块', drumstick: '鸡腿', egg: '煎蛋',
      cola: '可乐', milktea: '奶茶', milk: '牛奶', sushi: '寿司', fries: '薯条'
    },
    clickResponses: ['嗨~今天我也很喜欢你', 'lolo 收到！', '再点一下试试'],
    idleMessages: ['你已经很久没理我了', '我在这里陪你', '记得喝水哦~'],
    // 专注中点击 lolo 的加油语（config.clickResponses 为空时的兜底）
    cheerPool: ['加油！', '你可以的！', '专注的力量 💪', '稳住，马上就好~']
  };

  const CONTENT_EN = {
    states: {
      sleep: { label: 'Sleep', messages: ['Zzz…', 'Hoo—hoo—', 'Let lolo get some rest ~'] },
      walk: { label: 'Walk Around', messages: ['Strolling around ~', "What's fun over there?", 'A walk helps digestion!'] },
      walk_left: { label: 'Walk Around (Left)', messages: ['Let’s go the other way ~', 'This way this time'] },
      turn: { label: 'Turn Around', messages: ['Spin spin ~', 'Look how flexible I am!'] },
      upside_down: { label: 'Handstand', messages: ['Look at my handstand!', 'The world is upside down ~'] },
      grab: { label: 'Picked Up', messages: ['Whoa—put me down!', 'Help, I’m flying ~'] },
      grab_held: { label: 'Picked Up (Frozen)' },
      drop: { label: 'Put Down', messages: ['Ouch, landed on my butt', 'Solid ground feels good ~'] },
      cheer: { label: 'Cheer', messages: ['You can do it!', 'You’re the best!', 'Go go go!'] },
      roll_over: { label: 'Roll Over (deep sleep)', messages: ['Comfier on the other side ~'] },
      lying_back: { label: 'Lying on Back (deep sleep)', messages: ['Belly up, so relaxed…', 'Zzz…'] },
      feed: { label: 'Feed', messages: ['Yummy ~', 'Thanks for the treat!', 'I’m so full ~', 'Mmm, delicious'] },
      focus_start: { label: 'Pomodoro Start', messages: ['Timer started! I’ll keep you company ~', 'Look, the little timer is running', 'Focus mode, go!'] },
      drink: { label: 'Drink', messages: ['Gulp gulp ~ hydration!', 'Water break time', 'Water keeps you glowing ~'] },
      daze: { label: 'Dozing Off', messages: ['Sleepy… my eyelids are fighting', 'Zzz… (even focusing needs a nap)', 'Just a little longer ~'] },
      read: { label: 'Reading', messages: ['Reading quietly ~', 'Knowledge is power!', 'One page, then another'] }
    },
    foods: {
      cake: 'Cake', burger: 'Burger', nuggets: 'Nuggets', drumstick: 'Drumstick', egg: 'Fried Egg',
      cola: 'Cola', milktea: 'Milk Tea', milk: 'Milk', sushi: 'Sushi', fries: 'Fries'
    },
    clickResponses: ['Hey~ I like you a lot today too', 'lolo got it!', 'Click me again'],
    idleMessages: ['You haven’t paid attention to me in a while', 'I’m here with you', 'Remember to drink water ~'],
    // Encouragement lines when clicking lolo during focus (fallback when clickResponses is empty)
    cheerPool: ['Keep going!', 'You can do it!', 'The power of focus 💪', 'Hang in there, almost there ~']
  };

  const UI = { 'zh-CN': ZH, 'en-US': EN };
  const CONTENT = { 'zh-CN': CONTENT_ZH, 'en-US': CONTENT_EN };

  const LANGS = [
    { value: 'auto', zh: ZH['option.langAuto'], en: EN['option.langAuto'] },
    { value: 'zh-CN', zh: ZH['option.langZh'], en: EN['option.langZh'] },
    { value: 'en-US', zh: ZH['option.langEn'], en: EN['option.langEn'] }
  ];

  /** 把任意系统 locale（如 zh-Hans / en_GB / ja）归一化到受支持语言 */
  function normalize(locale) {
    const l = String(locale || '').toLowerCase();
    if (l.indexOf('zh') === 0 || l.indexOf('chi') === 0) return 'zh-CN';
    if (l.indexOf('en') === 0) return 'en-US';
    return null;
  }

  /**
   * 解析最终语言。
   * @param pref 用户偏好 'auto' | 'zh-CN' | 'en-US'
   * @param sysLocale 系统语言（主进程用 app.getLocale()，渲染进程用 navigator.language）
   */
  function resolveLang(pref, sysLocale) {
    if (pref && pref !== 'auto' && UI[pref]) return pref;
    return normalize(sysLocale) || 'zh-CN';
  }

  /** 取文案：找不到英文就用中文兜底，再找不到返回 key */
  function t(lang, key) {
    const table = UI[lang] || UI['zh-CN'];
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (Object.prototype.hasOwnProperty.call(UI['zh-CN'], key)) return UI['zh-CN'][key];
    return key;
  }

  /**
   * 把默认配置里的内置内容替换为目标语言。
   * 只改内置部分（状态标签/台词、食物名、互动文案），不影响视频文件名等数据。
   */
  function localizeDefaultConfig(base, lang) {
    const dict = CONTENT[lang] || CONTENT['zh-CN'];
    const out = JSON.parse(JSON.stringify(base));
    try {
      Object.keys(dict.states).forEach(function (stateId) {
        const srcState = dict.states[stateId];
        const target = out.states && out.states[stateId];
        if (!target) return;
        if (srcState.label) target.label = srcState.label;
        if (srcState.messages) target.messages = srcState.messages.slice();
      });
      (out.foods || []).forEach(function (food) {
        if (dict.foods[food.id]) food.name = dict.foods[food.id];
      });
      if (dict.clickResponses) out.clickResponses = dict.clickResponses.slice();
      if (dict.idleMessages) out.idleMessages = dict.idleMessages.slice();
    } catch (e) { /* 内容局部化失败不应影响启动，回退用原配置 */ }
    return out;
  }

  /**
   * 按目标语言替换「内置内容」，但保护用户自定义过的部分：
   * 只有当当前值仍等于 zh-CN 或 en-US 的默认值时，才认为它没被改过并进行翻译。
   * 这样英文用户看到英文内置文案，而中文用户自定义的台词不会被覆盖。
   */
  function relocalizeContent(cfg, lang) {
    if (!cfg) return cfg;
    const sources = [CONTENT['zh-CN'], CONTENT['en-US']];
    const target = CONTENT[lang] || CONTENT['zh-CN'];
    try {
      Object.keys(target.states).forEach(function (stateId) {
        const cfgState = cfg.states && cfg.states[stateId];
        const wanted = target.states[stateId];
        if (!cfgState || !wanted) return;
        if (wanted.label) cfgState.label = wanted.label;
        if (!wanted.messages) return;
        const cur = Array.isArray(cfgState.messages) ? cfgState.messages : [];
        if (cur.length === 0) { cfgState.messages = wanted.messages.slice(); return; }
        // 整组都还是默认值时才整体替换，避免与用户自写台词混杂
        const untouched = cur.every(function (v) {
          return sources.some(function (d) {
            return d.states[stateId] && d.states[stateId].messages && d.states[stateId].messages.indexOf(v) >= 0;
          });
        });
        if (untouched) cfgState.messages = wanted.messages.slice();
      });
      (cfg.foods || []).forEach(function (food) {
        const wasDefault = sources.some(function (d) { return d.foods[food.id] === food.name; });
        if (target.foods[food.id] && (wasDefault || !food.name)) food.name = target.foods[food.id];
      });
      ['clickResponses', 'idleMessages'].forEach(function (k) {
        const cur = cfg[k];
        if (!Array.isArray(cur) || cur.length === 0) { cfg[k] = target[k].slice(); return; }
        const untouched = cur.every(function (v) {
          return sources.some(function (d) { return d[k] && d[k].indexOf(v) >= 0; });
        });
        if (untouched) cfg[k] = target[k].slice();
      });
    } catch (e) { /* 内容局部化失败不应影响启动 */ }
    return cfg;
  }

  const api = { UI: UI, CONTENT: CONTENT, LANGS: LANGS, normalize: normalize, resolveLang: resolveLang, t: t, localizeDefaultConfig: localizeDefaultConfig, relocalizeContent: relocalizeContent };

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LoloI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
