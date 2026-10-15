#!/bin/bash
# ==========================================================
#  lolo 桌宠 · Mac 一键安装 / 启动脚本
# ==========================================================
#  用法（Mac「终端」里粘贴这一行并回车）：
#
#    curl -sL https://ghfast.top/https://raw.githubusercontent.com/bobobizzz/lolo/main/install-mac.sh | bash
#
#  脚本会自动完成：
#    1. 检查 Node.js
#    2. 下载源码（走国内反代，不用挂梯子）
#    3. 配置国内镜像
#    4. 只装运行必需的依赖（electron + electron-updater，跳过打包工具）
#    5. ★重建 ad-hoc 本地签名（根因修复：Electron 缓存缺 _CodeSignature，
#       系统判定"签名无效程序"会把它清理掉，只清隔离标记没用）
#    6. 部署已签名母本 ~/lolo/Electron.app + 桌面「启动lolo」自愈启动器
#    7. 直接拉起 lolo
#
#  幂等：已装则直接启动，不重复下载。
#  重装： rm -rf ~/lolo/lolo-main  后重跑。
#  重要：桌面启动器一旦存在【不会被覆盖】（保留你已工作的版本）；
#        要强制重建它，删除后重跑，或加 --force 参数。
# ==========================================================

set -e

FORCE=0
[ "$1" = "--force" ] && FORCE=1

WORK="$HOME/lolo"
ZIP_URL="https://ghfast.top/https://github.com/bobobizzz/lolo/archive/refs/heads/main.zip"
SRC_DIR="$WORK/lolo-main"
MASTER_APP="$WORK/Electron.app"                              # 已签名母本
RUN_APP="$SRC_DIR/node_modules/electron/dist/Electron.app"    # 运行位
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
  # 优先用 macOS 原生 ditto（对 UTF-8 中文文件名最稳，避免 BSD unzip 把中文名解成乱码）
  if command -v ditto >/dev/null 2>&1; then
    ditto -x -k lolo-src.zip . >/dev/null 2>&1 || unzip -q -o lolo-src.zip
  else
    unzip -q -o lolo-src.zip
  fi
  rm -f lolo-src.zip
  echo "✔ 源码已就绪：$SRC_DIR"
fi

cd "$SRC_DIR"

# ---------- 3.5 自愈：上次运行中断留下的临时 package.json ----------
# 安装期间用的是临时 package.json，若中途断开会残留备份文件；不恢复的话
# 下一次 npm start 会因为找不到 start 脚本而失败
if [ -f "$SRC_DIR/package.json.lolo.bak" ]; then
  echo "⚙ 发现上次中断的残留，正在恢复 package.json..."
  mv -f "$SRC_DIR/package.json.lolo.bak" "$SRC_DIR/package.json"
fi

# ---------- 4. 配置国内镜像 ----------
# 关键：不配的话 Electron 本体从 GitHub 拉取，国内基本会卡死
echo "⚙ 配置国内加速镜像..."
npm config set registry https://registry.npmmirror.com
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# ---------- 5. 安装运行依赖 ----------
# 只装 electron + electron-updater，用临时 package.json 避开
# electron-builder / javascript-obfuscator / rcedit 这些打包期才用得着的大件
if [ -d "$RUN_APP" ]; then
  echo "✔ 运行依赖已安装，跳过"
else
  echo "↓ 正在安装运行依赖（electron + electron-updater）"
  echo "  这一步要下载 Electron 约 100-200MB，请耐心等待，不要关闭窗口..."
  # 强制干净重装：npm 看到 electron 目录还在会跳过安装，即使里面的 app 已被系统删掉
  rm -rf "$SRC_DIR/node_modules/electron"
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

# ---------- 5.5 重建 ad-hoc 本地签名（★根因修复）----------
# 现象：Electron.app 删了又丢 / 被系统 SIGKILL。
# 根因：本地 Electron 缓存 zip 里的 _CodeSignature 全部缺失，解压出的 app
#       签名 seal 无效，macOS 判定为"签名无效程序"直接清理。只清隔离标记(xattr)
#       或重装都没用——必须清掉坏签名、重建一份本地 ad-hoc 签名。
echo "🔍 校验 Electron 本地签名..."
if command -v codesign >/dev/null 2>&1; then
  if codesign --verify --deep --verbose=2 "$RUN_APP" >/dev/null 2>&1; then
    echo "✔ Electron 签名校验已通过"
  else
    echo "⚠ Electron 签名无效（缓存缺失 _CodeSignature，系统会当作签名无效程序清掉）"
    echo "  正在清掉旧签名并重建 ad-hoc 本地签名..."
    codesign --remove-signature "$RUN_APP" 2>/dev/null || true
    codesign --force --deep --sign - "$RUN_APP"
    if codesign --verify --deep --verbose=2 "$RUN_APP" >/dev/null 2>&1; then
      echo "✔ 签名重建完成且校验通过"
    else
      echo "⚠ 签名重建后仍校验失败，请运行：xcode-select --install  然后重跑本脚本"
    fi
  fi
else
  echo "ℹ 未检测到 codesign（需 Xcode Command Line Tools），跳过签名重建"
  echo "  如启动被系统拦截，请先：xcode-select --install"
fi

# ---------- 5.6 清除 Electron 的隔离标记 ----------
if [ -d "$RUN_APP" ]; then
  xattr -cr "$RUN_APP" 2>/dev/null || true
  echo "✔ 已清除 Electron 隔离标记"
fi

# ---------- 5.7 部署已签名母本（供启动器自愈恢复用）----------
if [ -d "$RUN_APP" ]; then
  echo "⚙ 部署已签名母本：$MASTER_APP"
  rm -rf "$MASTER_APP"
  cp -R "$RUN_APP" "$MASTER_APP"
  xattr -cr "$MASTER_APP" 2>/dev/null || true
fi

# ---------- 6. 生成桌面双击启动器（存在则保留，不覆盖）----------
if [ -f "$DESKTOP_LAUNCHER" ] && [ "$FORCE" -eq 0 ]; then
  echo "✔ 桌面启动器已存在，保留现有版本（如需重建请删除它或加 --force 重跑）"
else
  echo "⚙ 生成桌面启动图标（自愈版）..."
  cat > "$DESKTOP_LAUNCHER" <<EOF
#!/bin/bash
# lolo 桌宠 · 自愈启动器
SRC_DIR="$SRC_DIR"
MASTER_APP="$MASTER_APP"
RUN_APP="\$SRC_DIR/node_modules/electron/dist/Electron.app"
# 运行位丢失 → 从已签名母本恢复
if [ ! -d "\$RUN_APP" ] && [ -d "\$MASTER_APP" ]; then
  echo "[lolo] 运行位缺失，从母本恢复..."
  cp -R "\$MASTER_APP" "\$RUN_APP"
fi
# 清隔离 + 去掉可能让 Electron 退化为纯 Node 的环境变量
xattr -cr "\$RUN_APP" 2>/dev/null
xattr -cr "\$MASTER_APP" 2>/dev/null
cd "\$SRC_DIR"
# 直接拉起 Electron 本体（绕开 npm，更快更稳）
exec env -u ELECTRON_RUN_AS_NODE "\$RUN_APP/Contents/MacOS/Electron" "\$SRC_DIR" 2>/dev/null || exec npm start
EOF
  chmod +x "$DESKTOP_LAUNCHER"
  echo "✔ 已生成：桌面「启动lolo」"
fi

# ---------- 7. 启动 ----------
echo ""
echo "=========================================="
echo "  正在启动 lolo..."
echo "  以后打开：双击桌面上的「启动lolo」"
echo "  首次若弹「无法验证开发者」：系统设置 → 隐私与安全性 → 仍要打开（只需一次）"
echo "  退出软件：点托盘小图标退出，或按 Ctrl+C"
echo "  更新版本：rm -rf ~/lolo/lolo-main 后重跑安装命令"
echo "=========================================="
echo ""

if [ -d "$RUN_APP" ]; then
  xattr -cr "$RUN_APP" 2>/dev/null || true
  cd "$SRC_DIR"
  env -u ELECTRON_RUN_AS_NODE "$RUN_APP/Contents/MacOS/Electron" "$SRC_DIR" || npm start
elif [ -d "$MASTER_APP" ]; then
  cp -R "$MASTER_APP" "$RUN_APP"
  xattr -cr "$RUN_APP" 2>/dev/null || true
  cd "$SRC_DIR"
  env -u ELECTRON_RUN_AS_NODE "$RUN_APP/Contents/MacOS/Electron" "$SRC_DIR" || npm start
else
  cd "$SRC_DIR"
  npm start
fi
