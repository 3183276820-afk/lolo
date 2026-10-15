# lolo（Mac 版）一键放行说明

因为 lolo 没走苹果付费签名，新版 macOS（Ventura / Sonoma / Sequoia 及以后）第一次打开会拦一下。按下面做**只需一次**，以后从启动台双击就能用，不再弹拦截。

> 适用对象：从 GitHub / 反代链接下载了 `lolo-desktop-pet-*-x64.dmg` 或 `-arm64.dmg` 的朋友。

---

## 第一步：把 lolo 装进「应用程序」

1. 双击下载好的 `.dmg` 打开。
2. 把里面的 **lolo 小熊图标拖到窗口里的「Applications（应用程序）」文件夹**上。
3. 拖完可以右键桌面上的 dmg →「推出」。

---

## 第二步：复制下面整段，粘到终端运行（核心一步）

1. 按 `Command + 空格` → 输入「终端」或 `Terminal` → 回车打开。
2. **把下面这一整行**一次性复制、粘贴进终端，按回车：

```bash
for p in "/Applications/lolo桌宠.app" "/Applications/lolo.app" "/Applications/lolo-desktop-pet.app"; do [ -d "$p" ] && APP="$p" && break; done; if [ -z "$APP" ]; then echo "没找到 lolo，请先把 lolo 拖进 应用程序 文件夹再运行本脚本"; exit 1; fi; xattr -cr "$APP"; echo "已放行：$APP"; open "$APP"
```

- 这一行会自动：找到 lolo → 摘掉「从网上下载需隔离」的标记 → 直接打开 lolo。
- 运行后 lolo 小熊出现就成功了，**以后从启动台双击即可**，不再需要任何操作。

---

## 如果弹窗是「已阻止恶意软件并移到废纸篓」（最严厉情况）

如果你看到的是下面这种弹窗，说明 macOS 的 Gatekeeper 直接把 lolo 当成「无签名软件」删进废纸篓了：

> 已阻止恶意软件并移到废纸篓  
> 未打开“lolo.app”，因其包含恶意软件。此操作未对 Mac 造成危害。

**这不是病毒**，是 Sequoia 对未签名 / 未公证 app 的最严厉拦截文案。这种情况下上面的 `xattr` 脚本**无效**（app 已经被删了），需要临时关闭 Gatekeeper 装一次。

### 操作步骤

1. **从废纸篓把 lolo 拖出来**，或者重新下载一次 dmg。
2. 打开「终端」，粘贴下面这行并回车（会要求输入开机密码）：

```bash
sudo spctl --master-disable
```

3. 打开 **系统设置 → 隐私与安全性 → 安全性 → 允许以下来源的应用程序**，选择「**任何来源**」。
4. 把 lolo 拖进「应用程序」文件夹。
5. 现在从启动台或应用程序文件夹打开 lolo，应该能正常进入。
6. （建议）再清一次隔离标记，确保以后恢复 Gatekeeper 也不会被拦：

```bash
xattr -cr "/Applications/lolo桌宠.app"
```

7. 安装完成后，恢复安全设置（lolo 已放行，恢复后不影响）：

```bash
sudo spctl --master-enable
```

---

## 极少数情况：第二步后仍被拦

终端再粘贴这一行（会让你输入**开机密码**，输入时屏幕不显示字符，正常）：

```bash
sudo spctl --master-disable
```

然后打开 **系统设置 → 隐私与安全性 → 允许以下来源的应用程序 → 选「任何来源」**，再打开 lolo。
装好、能正常用之后，想恢复安全设置可在终端执行：

```bash
sudo spctl --master-enable
```

（lolo 已经放行过，恢复后也不受影响。）

---

## 原理（可发给朋友看，打消顾虑）

lolo 是开源桌面宠物，作者没有购买苹果 $99/年的开发者签名，所以 macOS 会把它当成「来路不明」拦一次。软件本身无病毒，手动放行一次即可，和装一些独立开发的小工具一样常见。
