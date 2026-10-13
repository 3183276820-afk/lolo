// 校验 macOS 两个架构的 dmg 文件名不会在上传 GitHub 时被改名、互相覆盖。
//
// 背景（踩过的坑）：electron-builder 的 dmg-builder 调用
//   packager.computeSafeArtifactName(artifactName, "dmg")
// 时**没有传 arch**，导致架构宏被丢弃，x64 与 arm64 被洗成同一个
// GitHub 安全名（如 `lolo-desktop-pet-1.0.3.dmg`），后上传者覆盖前者，
// Release 里最后只剩一个（且是 arm64 版，Intel Mac 只能靠 Rosetta 跑）。
//
// 规避原理：只要本地文件名本身是 GitHub 安全名（仅 [0-9A-Za-z._-]），
// computeSafeArtifactName 会返回 null，发布器直接回退用 basename(本地文件)，
// 于是 x64 / arm64 各自保留独立文件名。
// 本脚本守住这条前提，一旦有人把 artifactName 改回中文名就立刻红叉报警。

const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, '..', 'dist')
const SAFE_NAME = /^[0-9A-Za-z._-]+$/

if (!fs.existsSync(DIST)) {
  console.error(`::error::dist 目录不存在：${DIST}（构建是否失败了？）`)
  process.exit(1)
}

const dmgs = fs.readdirSync(DIST).filter(f => f.endsWith('.dmg'))
console.log('dmg 产物:', dmgs.length ? dmgs.join(', ') : '(无)')

if (dmgs.length !== 2) {
  console.error(`::error::期望 2 个 dmg（x64 + arm64），实际 ${dmgs.length} 个`)
  process.exit(1)
}

let fatal = false
for (const f of dmgs) {
  if (!SAFE_NAME.test(f)) {
    console.error(
      `::error::dmg 文件名含非 ASCII 字符，上传到 GitHub 时会被 electron-builder ` +
        `改名并丢失架构后缀，导致 x64/arm64 互相覆盖：${f}`
    )
    fatal = true
  }
}

const expected = ['x64', 'arm64'].filter(a => !dmgs.some(f => f.includes(`-${a}.dmg`)))
if (expected.length) {
  console.error(`::error::缺少架构标识 ${expected.join(' / ')} 的 dmg，无法区分两个架构`)
  fatal = true
}

if (new Set(dmgs).size !== dmgs.length) {
  console.error('::error::两个 dmg 同名，上传时必然互相覆盖')
  fatal = true
}

if (fatal) process.exit(1)
console.log('✅ 校验通过：两个架构文件名唯一、且为 GitHub 安全名，不会互相覆盖')
