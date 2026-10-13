// 知识产权保护构建脚本：源码混淆 + asar 封装
// ---------------------------------------------------------------------------
// 设计原则：
//   1. 只保护「发布产物」，绝不损伤本地源码 —— 混淆前备份、打包后必定还原（finally）。
//   2. 源码目录 src/ 始终保持可读可改，日常开发不受任何影响。
//   3. 混淆选项刻意保守：绝不 renameProperties / transformObjectKeys，
//      否则跨进程 payload 的字段名（如 p.kind）与 API 对象键名会被改坏。
// 用法：node build/protect.js  （或 npm run protect）
//       STRENGTH=low|normal|high node build/protect.js
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const obfuscator = require('javascript-obfuscator');
const builder = require('electron-builder');

const root = path.join(__dirname, '..');
const BACKUP_DIR = path.join(root, '_src_plain'); // 明文备份（不在 files 白名单内，不会被打包）

// 需要保护的 JS：主进程、预加载、以及 src 下全部脚本
function collectTargets() {
  const list = ['main.js', 'preload.js'];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.js')) list.push(path.relative(root, p).replace(/\\/g, '/'));
    }
  };
  walk(path.join(root, 'src'));
  return list;
}

// 强度档位：越高越难读，但编译越慢、体积越大
function optionsFor(level) {
  const base = {
    compact: true,
    simplify: true,
    // —— 以下两项是「保命开关」，绝不能开 ——
    renameProperties: false,        // 会改坏 api.xxx / payload.kind 等跨模块键名
    transformObjectKeys: false,     // 同上，会破坏 IPC 传递的对象字面量
    renameGlobals: false,
    selfDefending: false,           // 会干扰格式化与调试，且拖慢启动
    debugProtection: false,
    disableConsoleOutput: false,    // 保留 console，方便排错
    splitStrings: false,
    numbersToExpressions: false,
    unicodeEscapeSequence: false,
    identifierNamesGenerator: 'mangled'
  };
  if (level === 'low') {
    return Object.assign({}, base, {
      stringArray: true, stringArrayThreshold: 0.5, stringArrayEncoding: ['none'],
      controlFlowFlattening: false, deadCodeInjection: false
    });
  }
  if (level === 'high') {
    return Object.assign({}, base, {
      controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: false, // 死代码注入体积膨胀明显，保持关闭
      stringArray: true, stringArrayThreshold: 1, stringArrayEncoding: ['base64'],
      stringArrayRotate: true, stringArrayShuffle: true, stringArrayWrappersCount: 3
    });
  }
  // normal（默认）
  return Object.assign({}, base, {
    controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: false,
    // threshold=1：所有字符串（含日志文本）一律进加密数组，杜绝残留可读函数名
    stringArray: true, stringArrayThreshold: 1, stringArrayEncoding: ['base64'],
    stringArrayRotate: true, stringArrayShuffle: true, stringArrayWrappersCount: 2
  });
}

function backup(files) {
  files.forEach((rel) => {
    const dst = path.join(BACKUP_DIR, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dst);
  });
}

// 判断一段代码是否为混淆态（混淆产物是单行 + 自带 parseInt 自解码循环）
function isObfuscatedCode(code) {
  return /\(function\([a-z]\(\)\)\{[\s\S]*parseInt\(/.test(code) ||
         /const [a-z]=b,?[a-z]=b;/.test(code);
}

function restore(files) {
  let allOk = true;
  files.forEach((rel) => {
    const src = path.join(BACKUP_DIR, rel);
    if (!fs.existsSync(src)) { allOk = false; console.error(`[protect] 还原缺失备份: ${rel}`); return; }
    try {
      const plain = fs.readFileSync(src, 'utf-8');
      // 防御：若备份本身已是混淆态，绝不能把它当明文写回（否则源码永久损坏）
      if (isObfuscatedCode(plain)) { allOk = false; console.error(`[protect] 备份本身是混淆态，拒绝还原: ${rel}`); return; }
      fs.copyFileSync(src, path.join(root, rel));
    } catch (e) { allOk = false; console.error(`[protect] 还原失败: ${rel}`, e && e.message); }
  });
  if (allOk) {
    try { fs.rmSync(BACKUP_DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    console.log('[protect] 还原完成，_src_plain/ 已清理');
  } else {
    // 关键：还原未完全成功时，绝不删除备份！保留 _src_plain/ 以便手动恢复，
    // 杜绝“源码被混淆且备份被删、无明文可恢复”的事故。
    console.error('[protect] 还原未完全成功 —— 保留 _src_plain/ 不删除，请检查上面的错误！');
  }
}

function obfuscateAll(files, opts) {
  files.forEach((rel) => {
    const abs = path.join(root, rel);
    const code = fs.readFileSync(abs, 'utf-8');
    const out = obfuscator.obfuscate(code, opts).getObfuscatedCode();
    fs.writeFileSync(abs, out, 'utf-8');
    const before = Buffer.byteLength(code, 'utf-8');
    const after = Buffer.byteLength(out, 'utf-8');
    console.log(`[protect] ${rel.padEnd(28)} ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB`);
  });
}

// 混淆后立即做语法自检：坏了就中止，绝不把坏代码打进包
// 注意：不能用 spawnSync(process.execPath, ['--check', ...]) —— 托管/隔离目录的
// node.exe 在当前进程已加载时同步派生会报 EBUSY（status=null），导致误报“全部失败”。
// 改用 Node 内置 vm.Script 做纯进程内编译校验，零派生、零误报。
function verifySyntax(files) {
  let bad = 0;
  files.forEach((rel) => {
    const abs = path.join(root, rel);
    try {
      // 包进 IIFE 再编译：允许顶层 return（CommonJS 模块运行时本就被函数包裹），
      // 同时任何真实语法错误（括号/标识符/字面量）都会在此抛出。
      new vm.Script('(function(){\n' + fs.readFileSync(abs, 'utf-8') + '\n})();', { filename: abs });
    } catch (e) {
      bad++;
      console.error(`[protect] 语法校验失败: ${rel}\n${e && (e.stack || e.message)}`);
    }
  });
  if (bad) throw new Error(`混淆后有 ${bad} 个文件语法损坏，已中止打包`);
  console.log(`[protect] 语法自检通过（${files.length} 个文件）`);
}

function build() {
  // 直接用 electron-builder 程序内 API，绝不再 spawn 托管 node（会 EBUSY）。
  // build() 会读取 package.json 的 build 配置（win.target=portable, asar=true），
  // publish:'never' 等价于 --publish never。
  console.log('\n[protect] 开始打包（混淆版，程序内调用 electron-builder）...\n');
  return builder.build({ publish: 'never' })
    .then(() => true)
    .catch((e) => {
      console.error(`\n[protect] 打包失败:`, e && (e.stack || e.message));
      return false;
    });
}

(async function main() {
  const level = (process.env.STRENGTH || 'normal').toLowerCase();
  const files = collectTargets();
  console.log(`[protect] 强度=${level}  待保护文件 ${files.length} 个`);
  console.log('[protect] 备份明文源码到 _src_plain/ ...');
  backup(files);

  let ok = false;
  try {
    obfuscateAll(files, optionsFor(level));
    verifySyntax(files);
    if (process.env.DRY_RUN) {
      console.log('[protect] DRY_RUN=1：跳过打包（仅验证混淆与还原）');
      ok = true;
    } else {
      ok = await build();
    }
  } catch (e) {
    console.error('[protect] 执行出错：', e && (e.stack || e.message));
  } finally {
    console.log('\n[protect] 还原明文源码（保证 src/ 始终可读）...');
    restore(files);
    console.log('[protect] 还原完成，_src_plain/ 已清理');
  }
  process.exit(ok ? 0 : 1);
})();
