#!/bin/bash
# ==========================================================
#  lolo 桌宠 · Mac 一键安装 / 启动脚本
# ==========================================================
#  用法（在 Mac「终端」里粘贴这一行并回车）：
#
#    curl -sL https://ghfast.top/https://raw.githubusercontent.com/bobobizzz/lolo/main/install-mac.sh | bash
#
#  脚本会自动完成：
#    1. 检查 Node.js    2. 下载源码（走国内反代，不用挂梯子）
#    3. 配置国内镜像    4. 只装运行必需的依赖（跳过打包工具，省时间）
#    5. 在桌面生成「启动lolo」双击图标（本机生成，不会被系统拦截）
#    6. 直接启动 lolo
#
#  已经装过再跑一次 = 直接启动（幂等，不会重复下载安装）
#  想更新到最新版： rm -rf ~/lolo/lolo-main  然后重跑上面那一行命令
# ==========================================================

set -e

WORK="$HOME/lolo"
ZIP_URL="https://ghfast.top/https://github.com/bobobizzz/lolo/archive/refs/heads/main.zip"
SRC_DIR="$WORK/lolo-main"
DESKTOP_LAUNCHER="$HOME/Desktop/启动lolo.command"

echo ""
echo "=========================================="
echo "   lolo 桌宠 · Mac 一键安装"
echo "=========================================="
echo ""

# ---------- 1. 检查 Node.js ----------
if ! command -v node >/dev/null 2>&1; then
  echo "✘ 没有检测到 Node.js（必须先装它才能跑源码）"
  echo ""
  echo "  正在为你打开下载页面：请下载左侧 LTS 版本（Apple 芯片版），"
  echo "  双击安装包一路安装完毕后，重新运行本脚本即可。"
  echo ""
  open "https://nodejs.org" 2>/dev/null || true
  exit 1
fi
echo "✔ 已检测到 Node.js：$(node -v)"

# ---------- 2. 下载 / 解压源码 ----------
mkdir -p "$WORK"
cd "$WORK"

if [ -f "$SRC_DIR/main.js" ]; then
  echo "✔ 源码已存在，跳过下载"
else
  echo "↓ 正在下载源码（国内反代，稍等）..."
  curl -L --max-time 300 -o lolo-src.zip "$ZIP_URL"
  echo "↓ 正在解压..."
  unzip -q -o lolo-src.zip
  rm -f lolo-src.zip
  echo "✔ 源码已就绪：$SRC_DIR"
fi

cd "$SRC_DIR"

# ---------- 3. 配置国内镜像 ----------
# 关键：不配的话 Electron 本体从 GitHub 拉取，国内基本会卡死
echo "⚙ 配置国内加速镜像..."
npm config set registry https://registry.npmmirror.com
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# ---------- 4. 安装运行依赖 ----------
# 只装 electron + electron-updater，用临时 package.json 避开
# electron-builder / javascript-obfuscator / rcedit 这些打包期才用得着的大件
if [ -d "$SRC_DIR/node_modules/electron" ]; then
  echo "✔ 运行依赖已安装，跳过"
else
  echo "↓ 正在安装运行依赖（electron + electron-updater）"
  echo "  这一步要下载 Electron 约 100-200MB，请耐心等待，不要关闭窗口..."
  cp package.json package.json.lolo.bak
  cat > package.json <<'PKG'
{
  "name": "lolo-run",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "electron": "^31.0.0",
    "electron-updater": "^6.8.9"
  }
}
PKG
  npm install --no-audit --no-fund
  mv package.json.lolo.bak package.json
  echo "✔ 依赖安装完成"
fi

# ---------- 5. 生成桌面双击启动器 ----------
# 本机创建的文件不带「网上下载」标记，所以不会被 Gatekeeper 拦截
echo "⚙ 生成桌面启动图标..."
cat > "$DESKTOP_LAUNCHER" <<EOF
#!/bin/bash
cd "$SRC_DIR"
exec npm start
EOF
chmod +x "$DESKTOP_LAUNCHER"
echo "✔ 已生成：桌面「启动lolo」"

echo ""
echo "=========================================="
echo "  安装完成！正在启动 lolo..."
echo "  以后打开：双击桌面上的「启动lolo」"
echo "  退出软件：点托盘小图标退出，或按 Ctrl+C"
echo "  更新版本：rm -rf ~/lolo/lolo-main 后重跑安装命令"
echo "=========================================="
echo ""

# ---------- 6. 启动 ----------
npm start
