# lolo 桌宠 · 使用说明 / User Guide

> 版本 v1.0.2 · 支持 Windows 10/11、Windows 7（专版）、macOS
> Version v1.0.2 · Windows 10/11, Windows 7 (dedicated build), macOS

---

<a id="zh"></a>

## 目录（中文）

1. [快速开始](#zh-1)
2. [托盘图标与右键菜单](#zh-2)
3. [拖拽与互动](#zh-3)
4. [喂食](#zh-4)
5. [番茄钟专注](#zh-5)
6. [喝水提醒与日程提醒](#zh-6)
7. [面板设置详解](#zh-7)
8. [语言切换](#zh-8)
9. [更新与分发](#zh-9)
10. [常见问题](#zh-10)

---

### <a id="zh-1"></a>1. 快速开始

1. 从 Releases 页面下载对应你系统的安装包：
   - **Windows 10 / 11**：`lolo-desktop-pet-setup-1.0.2.exe`（安装版，支持自动更新）
   - **Windows 便携版**：`lolo-desktop-pet-1.0.2.exe`（免安装，不自动更新）
   - **Windows 7**：`lolo-win7-x64.exe` 或 `lolo-win7-ia32.exe`（32 位老机器选 ia32）
   - **macOS**：`lolo桌宠.dmg`（拖入 Applications）
2. Windows 安装版一路下一步即可；便携版双击就能用。
3. 启动后 lolo 出现在屏幕右下角，程序本身**没有主窗口**，只在系统托盘留一个小图标。
4. 鼠标**悬停托盘图标**可以看到当前版本号（例如 `lolo 桌宠 v1.0.2`），这是核对版本最方便的方式。

> Windows 7 补充前提：需已安装 SP1、KB2999226（Universal CRT）与 Visual C++ 2015-2022 运行库。

### <a id="zh-2"></a>2. 托盘图标与右键菜单

找不到托盘图标时，点任务栏右侧的 **`∧` 展开隐藏图标区**。

**托盘右键**：

| 菜单项 | 作用 |
| --- | --- |
| 打开面板 | 打开设置面板 |
| 喂食 | 直接唤出食物选择器 |
| 恢复默认待机 | 专注中回到看书/打瞌睡；平时回到面板设定的闲置模式 |
| 退出 | 彻底关闭程序 |

**在 lolo 身上右键**会弹出功能菜单（悬浮跟随光标，不遮挡 lolo）：打开面板、喂食、番茄钟（15/25/45/60 分钟）、各种动作、恢复默认待机、退出。

### <a id="zh-3"></a>3. 拖拽与互动

| 操作 | lolo 的反应 |
| --- | --- |
| 按住拖动 | 被「拎起」，有专门的拎起姿势与台词；放到任意位置松手后会播放放下动画 |
| 单击 | 随机说一句话（可在面板自定义） |
| 长时间不理它 | 自动进入睡眠；睡得更久会翻身仰躺 |
| 长时间无操作 | 按面板设定，可能自己起来到处走走 |

### <a id="zh-4"></a>4. 喂食

- 默认内置 10 种食物：蛋糕、汉堡、鸡块、鸡腿、煎蛋、可乐、奶茶、牛奶、寿司、薯条。
- 管理路径：**右键托盘 → 打开面板 → 互动设置 → 喂食食物**。
  - 可添加 / 删除食物；
  - 点「**上传图标**」可以换成自己的图片（建议**透明背景 PNG**，正方形效果最好）。
- 食物超过 5 种时，喂食选择器变成**可旋转轮盘**：滚动鼠标滚轮或拖动即可旋转，上半圆始终显示 5 种。
- 某项食物的图标文件缺失时，投喂会自动跳过，不会报错。

### <a id="zh-5"></a>5. 番茄钟专注

1. 右键 lolo → **番茄钟** → 选择时长，开始专注。
2. 开场动画：lolo 先弯腰看地上的小计时器，再起身为你加油。
3. 专注期间：
   - lolo 在「**看书**」与「**打瞌睡**」之间随机切换；
   - 身上显示已专注时长（如 `已专注 12:34`）；
   - 单击 lolo 会得到鼓励话语。
4. 时间到会有提醒气泡，随后自动回到日常状态。
5. 默认时长与提醒动作可在 **面板 → 专注 & 日程提醒** 里调整。

### <a id="zh-6"></a>6. 喝水提醒与日程提醒

- **喝水提醒**：设置间隔（如每 40 分钟），到点 lolo 会强制播放喝水动画并弹气泡。喝水提醒**不受「提醒时播放动作」开关影响**——它的意义就是提醒你喝水。
- **日程提醒**：在面板里添加时间与重复方式（一次性 / 每天 / 工作日），还可设置**提前预告**时间（如提前 5 分钟）。
- 提醒气泡可点击关闭，也会在设定秒数后自动消失。
- 提醒期间 lolo 会表演对应动作（面板可开关或指定），面板还可设置气泡显示时长、字号。
- 提醒不会打断你的手动操作，表演结束后继续正常闲置计时。

### <a id="zh-7"></a>7. 面板设置详解

面板分三个标签页，改动后需点 **保存** 才会同步给桌宠：

| 标签页 | 主要设置 |
| --- | --- |
| **素材管理** | 桌宠大小（缩放，恒定正方形）、各动作素材文件、闲置默认模式、深度睡眠时间、随机走动间隔 |
| **互动设置** | 语言、点击回应、闲置话语、喂食食物清单（含上传图标） |
| **专注 & 日程提醒** | 番茄钟时长、喝水提醒间隔、日程列表、提醒动作、气泡显示时长与字号 |

另有「开机自启」开关，勾选后随系统登录自动运行。

### <a id="zh-8"></a>8. 语言切换

面板 → **互动设置** 页最上方有「**语言 Language**」下拉：

- **跟随系统**：系统语言为中文 → 中文；其他 → English。
- **简体中文 / English**：手动强制指定。

切换后**立即生效**，托盘菜单、气泡、面板、桌宠提示同步变化，不必重启。

> 重要设计：内置的食物名、状态台词、点击回应也会一并翻译，但**只翻译你没有修改过的项**。你自己改过的名字与台词会原样保留，不会因为切换语言被覆盖。

### <a id="zh-9"></a>9. 更新与分发

| 版本形态 | 更新方式 |
| --- | --- |
| Windows **安装版**（setup） | 发现新版本弹气泡 → 点击下载 → 下完再点一次即安装重启，**全自动** |
| Windows **便携版** | 设计上不参与自动更新，请到发布页下载新版替换 |
| **macOS** | 检测到新版本弹气泡并引导前往下载页，下载 dmg 拖入 Applications 覆盖 |
| **Windows 7 专版** | 不参与自动更新，手动下载替换 |

### <a id="zh-10"></a>10. 常见问题

| 现象 | 解决办法 |
| --- | --- |
| lolo 不见了 / 跑到屏幕外 | 多为显示缩放或分辨率变化所致。托盘右键 → 退出，重新启动即可回到默认位置 |
| 拖动时 lolo 越变越大 | 已在 v1.0.1 修复。请悬停托盘确认版本不低于 v1.0.1 |
| 上传食物图标没反应 | 必须点面板里的「上传图标」按钮走文件选择框；直接把图片丢进文件夹无效 |
| 面板改了没反应 | 改动要点「保存」才会同步给桌宠 |
| macOS 提示「无法验证开发者」 | 右键应用图标 → 打开；或终端执行 `xattr -cr /Applications/lolo桌宠.app` |
| Windows 7 打不开 | 安装 SP1、KB2999226 与 VC++ 2015-2022 运行库，并使用 win7 专版（32 位选 ia32） |
| 桌宠没有动画 | 确认 `assets/videos` 下的素材文件完整未被删除 |
| 更新到新版后问题依旧 | 确认已彻底退出旧进程（托盘右键→退出）再启动新版，并检查版本号 |

---
---

<a id="en"></a>

## Table of Contents (English)

1. [Quick Start](#en-1)
2. [Tray Icon & Menus](#en-2)
3. [Drag & Interact](#en-3)
4. [Feeding](#en-4)
5. [Pomodoro Focus](#en-5)
6. [Water & Schedule Reminders](#en-6)
7. [Panel Settings](#en-7)
8. [Language](#en-8)
9. [Updates](#en-9)
10. [Troubleshooting](#en-10)

---

### <a id="en-1"></a>1. Quick Start

1. Download the build for your system:
   - **Windows 10/11**: `lolo-desktop-pet-setup-1.0.2.exe` (installer, supports auto-update)
   - **Windows portable**: `lolo-desktop-pet-1.0.2.exe` (no install, no auto-update)
   - **Windows 7**: `lolo-win7-x64.exe` (use `ia32` for 32-bit machines)
   - **macOS**: `lolo桌宠.dmg` (drag into Applications)
2. Run the installer (or just double-click the portable exe).
3. lolo appears at the bottom-right. There is **no main window** — the app lives in the system tray.
4. **Hover the tray icon** to see the version (e.g. `lolo 桌宠 v1.0.2`).

> Windows 7 also requires SP1, KB2999226 (Universal CRT) and the VC++ 2015-2022 runtime.

### <a id="en-2"></a>2. Tray Icon & Menus

Can't find the tray icon? Click the **`∧` chevron** on the taskbar to expand hidden icons.

**Tray right-click**: Open Panel / Feed / Restore Default Idle / Quit.

**Right-click on lolo** opens the action menu (floating at the cursor, never covers lolo): Open Panel, Feed, Pomodoro (15/25/45/60 min), various actions, Restore Default Idle, Quit.

### <a id="en-3"></a>3. Drag & Interact

| Action | lolo's reaction |
| --- | --- |
| Press and drag | Picked up — special pose and lines; releasing plays a "put down" animation |
| Single click | Says a random line (customizable in the panel) |
| Left alone | Falls asleep; after longer still, rolls over onto its back |
| Long idle | May get up and walk around, depending on panel settings |

### <a id="en-4"></a>4. Feeding

- Ten foods ship by default: Cake, Burger, Nuggets, Drumstick, Fried Egg, Cola, Milk Tea, Milk, Sushi, Fries.
- Manage them: **Tray → Open Panel → Interaction → Feed Foods**.
  - Add / remove foods.
  - Click **Upload Icon** to use your own image (transparent square PNG recommended).
- With more than 5 foods the picker becomes a **rotating wheel**: scroll or drag to rotate — the top half always shows 5.
- Missing icon files are silently skipped when feeding.

### <a id="en-5"></a>5. Pomodoro Focus

1. Right-click lolo → **Pomodoro** → pick a duration.
2. Intro animation: lolo bends down to look at a little timer, then stands up to cheer.
3. During focus:
   - lolo alternates between **Reading** and **Dozing Off**;
   - an elapsed timer shows on the pet (e.g. `Focused 12:34`);
   - click lolo for encouragement.
4. A bubble notification fires when time is up, then normal routine resumes.
5. Default duration and reminder action: **Panel → Focus & Reminders**.

### <a id="en-6"></a>6. Water & Schedule Reminders

- **Water reminder**: set an interval (e.g. every 40 min); lolo always plays the drinking animation. It ignores the "play action on reminder" toggle — that reminder IS about drinking.
- **Schedule reminders**: add a time and repeat rule (once / daily / weekdays) plus optional **lead time** (e.g. 5 minutes early).
- Click the bubble to close it, or let it auto-dismiss.
- lolo performs a matching action (toggleable/configurable); bubble duration and font size are settable too.
- Reminders never interrupt your interaction; the idle timer resumes afterwards.

### <a id="en-7"></a>7. Panel Settings

Three tabs — click **Save** to sync changes to the pet:

| Tab | Contents |
| --- | --- |
| **Assets** | Pet size (scale, always square), per-action asset files, default idle mode, deep-sleep delay, random walk interval |
| **Interaction** | Language, click responses, idle lines, food list (with icon upload) |
| **Focus & Reminders** | Pomodoro length, water interval, schedules, reminder action, bubble duration & font size |

A "Start at login" toggle is also available.

### <a id="en-8"></a>8. Language

Panel → **Interaction** → top of the page → "**Language 语言**" dropdown:

- **Follow system** — Chinese when the system locale is Chinese, English otherwise.
- **简体中文 / English** — force a specific one.

Applies **instantly** to the tray menu, bubbles, panel and pet.

> Built-in food names, state lines and click responses are translated too — but **only the ones you have NOT edited**. Your custom names and lines are always preserved.

### <a id="en-9"></a>9. Updates

| Build | How it updates |
| --- | --- |
| Windows **installer** | Bubble appears → click to download → click again to install and restart (fully automatic) |
| Windows **portable** | No auto-update by design; download the new release manually |
| **macOS** | Bubble guides you to the downloads page; drag the new dmg into Applications |
| **Windows 7 build** | No auto-update; replace manually |

### <a id="en-10"></a>10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| lolo disappeared / off-screen | Caused by display scaling changes. Tray → Quit, then start again |
| Grows bigger while dragging | Fixed in v1.0.1. Hover the tray to confirm you are on v1.0.1+ |
| Uploading a food icon does nothing | Use the Upload Icon button in the panel; dropping files into folders has no effect |
| Panel changes have no effect | Click Save to sync them to the pet |
| macOS "cannot verify developer" | Right-click the app → Open, or run `xattr -cr /Applications/lolo桌宠.app` |
| Won't start on Windows 7 | Install SP1, KB2999226 and the VC++ 2015-2022 runtime; use the win7 build (ia32 for 32-bit) |
| No animations | Make sure the asset files under `assets/videos` are intact |
