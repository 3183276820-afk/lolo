// 自定义 Windows 签名步骤（无证书场景）
// 作用：electron-builder 默认会下载/解压 winCodeSign 做代码签名，当前环境无符号链接权限会失败。
// 这里用空签名替代默认流程，避免解压 winCodeSign；同时手动调用 rcedit 把图标/版本信息嵌进 exe。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function customSign(configuration) {
  const exePath = configuration && configuration.path;
  if (!exePath) {
    console.warn('[sign] 未收到待签名文件路径，跳过');
    return;
  }
  const root = path.join(__dirname, '..');
  const appBuilder = path.join(root, 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');
  const ico = path.join(root, 'assets', 'icon', 'lolo.ico');
  if (!fs.existsSync(appBuilder) || !fs.existsSync(ico)) {
    console.warn('[sign] 缺少 app-builder 或 lolo.ico，跳过图标嵌入（不影响运行）');
    return;
  }

  const args = ['rcedit', exePath, '--set-icon', ico];
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')); } catch (e) {}
  const ver = String(pkg.version || '1.0.0');
  args.push('--set-file-version', ver, '--set-product-version', ver);
  args.push('--set-version-string', 'ProductName', pkg.productName || 'lolo桌宠');
  args.push('--set-version-string', 'FileDescription', 'lolo 桌面萌宠');
  args.push('--set-version-string', 'InternalName', 'lolo');

  try {
    execFileSync(appBuilder, args, { stdio: 'inherit' });
    console.log('[sign] 已嵌入图标与版本信息，跳过代码签名:', exePath);
  } catch (e) {
    console.warn('[sign] rcedit 执行失败（图标可能未嵌入，不影响运行）:', e.message);
  }
};
