// 通过 node 子进程调用 app-builder 的 rcedit 子命令，给便携 exe 嵌入图标与版本信息。
// 注意：app-builder 的 rcedit 要求全部参数放进单个 --args="..." 里；为避免空格解析问题，版本字符串不加空格。
const { execFileSync } = require('child_process');
const path = require('path');

const exe = process.argv[2];
if (!exe) { console.error('用法: node tools/rcedit_icon.js <目标exe>'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const ab = path.join(root, 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');
const ico = path.join(root, 'assets', 'icon', 'lolo.ico');

// app-builder 的 rcedit 子命令要求 --args 为 base64(JSON 数组)
const arr = [
  exe,
  '--set-icon', ico,
  '--set-version-string', 'ProductName', 'lolo桌宠',
  '--set-version-string', 'FileDescription', 'lolo-desktop-pet',
  '--set-version-string', 'InternalName', 'lolo',
  '--set-file-version', '1.0.0',
  '--set-product-version', '1.0.0'
];
const b64 = Buffer.from(JSON.stringify(arr), 'utf-8').toString('base64');

execFileSync(ab, ['rcedit', '--args=' + b64], { stdio: 'inherit' });
console.log('[rcedit] 图标与版本信息已嵌入:', exe);
