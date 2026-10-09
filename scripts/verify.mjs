#!/usr/bin/env node
/**
 * 仓库自检：把 ZTools-Tauri 的安装期校验规则在本地跑一遍，并检查市场清单与产物一致。
 *
 * 校验内容（与宿主 `ztools-plugin` crate 的实现口径一致）：
 * 1. `plugin.json`：schema=2、反域名 id、语义化版本、`runtime.type=webview`、
 *    入口/图标是安全相对路径、权限点必须已知、feature code 唯一且 cmds 类型合法；
 * 2. 插件页面：入口文件存在、脚本语法可解析、脚本引用的元素 id 在 HTML 里存在；
 * 3. `.zpx`：能读回 `plugin.json`、条目无路径越界、无符号链接属性位；
 * 4. `release/plugins.json` / `categories.json`：与磁盘上的包、与源码目录三者一致
 *    （版本、大小、sha256、分类归属全部复核）。
 *
 * 用法：
 *   node scripts/verify.mjs
 *   node scripts/verify.mjs --skip-release      # 只校验插件源码（没构建时用）
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_DIR_NAME, listPlugins } from './lib/repo.mjs';
import { readStoredEntry } from './lib/zip.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const RELEASE_DIR = path.join(REPO_ROOT, RELEASE_DIR_NAME);

/** 宿主支持的清单 schema。 */
const SUPPORTED_SCHEMA = 2;

/** 宿主已知的权限点（`ztools-types::PermissionId::ALL`）。 */
const KNOWN_PERMISSIONS = [
  'storage.read',
  'storage.write',
  'clipboard.read',
  'clipboard.write',
  'dialog.open',
  'network',
  'shell.openExternal',
  'notification.show',
  'features.manage',
  'input.simulate',
  'screen.capture',
  'window.create',
  'fs.read.any',
  'fs.write.any'
];

/** 宿主支持的指令匹配类型。 */
const KNOWN_CMD_TYPES = ['over', 'files', 'regex'];

const problems = [];

/**
 * 记录一条失败。
 * @param {string} message 说明。
 * @returns {void}
 */
function fail(message) {
  problems.push(message);
}

/**
 * 校验反域名 id。
 * @param {string} id 插件 id。
 * @returns {boolean} 合法返回 true。
 */
function isValidId(id) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) return false;
  const segments = id.split('.');
  if (segments.length < 2) return false;
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment.length <= 63 &&
      !segment.startsWith('-') &&
      !segment.endsWith('-') &&
      /^[a-z0-9-]+$/.test(segment)
  );
}

/**
 * 校验语义化版本（major.minor.patch，可选 -pre / +build）。
 * @param {string} version 版本。
 * @returns {boolean} 合法返回 true。
 */
function isValidVersion(version) {
  if (typeof version !== 'string') return false;
  const core = version.split(/[-+]/)[0];
  const parts = core.split('.');
  return parts.length === 3 && parts.every((part) => /^[0-9]+$/.test(part));
}

/**
 * 校验"相对插件根"的安全路径。
 * @param {string} value 路径。
 * @returns {boolean} 合法返回 true。
 */
function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (value.includes('://') || value.includes(':')) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  return value
    .replace(/\\/g, '/')
    .split('/')
    .every((segment) => segment !== '' && segment !== '..');
}

/**
 * 校验一份清单。
 * @param {object} manifest 清单对象。
 * @param {string} label 用于错误信息的前缀。
 * @returns {void}
 */
function validateManifest(manifest, label) {
  if (manifest.schema !== SUPPORTED_SCHEMA) {
    fail(`${label}：schema 必须为 ${SUPPORTED_SCHEMA}，当前 ${manifest.schema}`);
  }
  if (!isValidId(manifest.id)) {
    fail(`${label}：id 必须是反域名（小写字母/数字/中划线，至少两段），当前 ${manifest.id}`);
  }
  if (!isValidVersion(manifest.version)) {
    fail(`${label}：version 必须是 major.minor.patch，当前 ${manifest.version}`);
  }
  if (manifest.runtime?.type !== 'webview') {
    fail(`${label}：runtime.type 仅支持 webview，当前 ${manifest.runtime?.type}`);
  }
  if (!isSafeRelativePath(manifest.runtime?.entry ?? '')) {
    fail(`${label}：runtime.entry 必须是安全相对路径，当前 ${manifest.runtime?.entry}`);
  }
  if (manifest.logo && !isSafeRelativePath(manifest.logo)) {
    fail(`${label}：logo 必须是安全相对路径，当前 ${manifest.logo}`);
  }
  if (manifest.development?.entry) {
    const entry = manifest.development.entry;
    const isHttp = entry.startsWith('http://') || entry.startsWith('https://');
    if (!isHttp && !isSafeRelativePath(entry)) {
      fail(`${label}：development.entry 必须是 http(s) 地址或安全相对路径`);
    }
  }
  for (const permission of manifest.permissions ?? []) {
    if (!KNOWN_PERMISSIONS.includes(permission)) {
      fail(`${label}：未知权限 ${permission}`);
    }
  }
  const codes = new Set();
  for (const feature of manifest.features ?? []) {
    if (!feature.code || feature.code.trim() === '') {
      fail(`${label}：features[].code 不能为空`);
    } else if (codes.has(feature.code)) {
      fail(`${label}：feature code 重复：${feature.code}`);
    } else {
      codes.add(feature.code);
    }
    if (!feature.label || feature.label.trim() === '') {
      fail(`${label}：features[]（${feature.code}）的 label 不能为空`);
    }
    if (feature.icon && !isSafeRelativePath(feature.icon)) {
      fail(`${label}：features[]（${feature.code}）的 icon 必须是安全相对路径`);
    }
    for (const cmd of feature.cmds ?? []) {
      if (!KNOWN_CMD_TYPES.includes(cmd.type)) {
        fail(`${label}：features[]（${feature.code}）的 cmds[].type 只能是 ${KNOWN_CMD_TYPES.join('/')}`);
      }
      if (
        typeof cmd.minLength === 'number' &&
        typeof cmd.maxLength === 'number' &&
        cmd.minLength > cmd.maxLength
      ) {
        fail(`${label}：features[]（${feature.code}）的 minLength > maxLength`);
      }
    }
  }
}

/**
 * 校验 `.zpx` 内部条目安全（路径越界 / 符号链接属性位）。
 * @param {string} zipPath 包路径。
 * @param {string} label 错误前缀。
 * @returns {void}
 */
function validatePackageEntries(zipPath, label) {
  const buffer = fs.readFileSync(zipPath);
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  for (let index = 0; index < count; index += 1) {
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    // 0o120000 = S_IFLNK：安装器会直接拒绝符号链接。
    if ((externalAttributes >>> 16) === 0o120000) {
      fail(`${label}：包内含符号链接条目 ${name}`);
    }
    if (name.startsWith('/') || name.split('/').some((segment) => segment === '..')) {
      fail(`${label}：包含越界条目 ${name}`);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
}

/**
 * 校验插件页面脚本：语法能过，且 `querySelector('#x')` 引用的 id 在 HTML 里存在。
 *
 * 这两条能挡掉最常见的手写错误（少个括号、改了 HTML 忘了改 JS），
 * 它们都要等页面白屏才会被发现。
 * @param {string} pluginDir 插件目录。
 * @param {object} manifest 清单。
 * @param {string} label 错误前缀。
 * @returns {void}
 */
function validatePage(pluginDir, manifest, label) {
  const htmlPath = path.join(pluginDir, manifest.runtime?.entry ?? '');
  if (!fs.existsSync(htmlPath)) {
    return; // 入口缺失已在别处报过
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatch = /<script[^>]+src="([^"]+)"/.exec(html);
  if (!scriptMatch) {
    fail(`${label}：入口页面没有引用任何脚本`);
    return;
  }
  const scriptPath = path.join(pluginDir, scriptMatch[1].replace(/^\.\//, ''));
  if (!fs.existsSync(scriptPath)) {
    fail(`${label}：入口页面引用的脚本不存在（${scriptMatch[1]}）`);
    return;
  }

  // ① 语法检查：插件脚本是 ESM，复制成 .mjs 再让 node 解析（不执行）。
  const probe = path.join(os.tmpdir(), `ztools-verify-${process.pid}-${path.basename(scriptPath)}.mjs`);
  try {
    fs.copyFileSync(scriptPath, probe);
    execFileSync(process.execPath, ['--check', probe], { stdio: 'pipe' });
  } catch (error) {
    fail(`${label}：${scriptMatch[1]} 语法检查失败（${String(error.stderr ?? error).slice(0, 200)}）`);
  } finally {
    fs.rmSync(probe, { force: true });
  }

  // ② 元素 id 交叉校验：只认 `querySelector('#id')` 这种静态写法。
  const source = fs.readFileSync(scriptPath, 'utf8');
  const ids = new Set([...source.matchAll(/querySelector\('#([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]));
  for (const id of ids) {
    if (!new RegExp(`id="${id}"`).test(html)) {
      fail(`${label}：脚本引用了 #${id}，但 ${manifest.runtime.entry} 里没有这个元素`);
    }
  }
}

// ---------- 1) 插件源码 ----------
const plugins = listPlugins(REPO_ROOT);
if (plugins.length === 0) {
  fail('plugins/ 下没有任何插件');
}
for (const plugin of plugins) {
  const label = `plugins/${plugin.dirName}`;
  validateManifest(plugin.manifest, label);
  const entryPath = path.join(plugin.path, plugin.manifest.runtime?.entry ?? '');
  if (!fs.existsSync(entryPath)) {
    fail(`${label}：runtime.entry 指向的文件不存在（${plugin.manifest.runtime?.entry}）`);
  }
  if (!fs.existsSync(path.join(plugin.path, 'vendor', 'ztools-sdk', 'index.js'))) {
    fail(`${label}：缺少 vendor/ztools-sdk/index.js（先跑 scripts/sync-sdk.mjs）`);
  }
  if (!fs.existsSync(path.join(plugin.path, 'CHANGELOG.md'))) {
    fail(`${label}：缺少 CHANGELOG.md（市场发布说明从这里取）`);
  }
  if (!fs.existsSync(path.join(plugin.path, 'README.md'))) {
    fail(`${label}：缺少 README.md（市场详情页用它）`);
  }
  validatePage(plugin.path, plugin.manifest, label);
}

// ---------- 2) 分类映射 ----------
const mappingPath = path.join(REPO_ROOT, 'categories-mapping.json');
if (!fs.existsSync(mappingPath)) {
  fail('缺少 categories-mapping.json');
} else {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const dirNames = new Set(plugins.map((plugin) => plugin.dirName));
  const mapped = new Set();
  for (const category of mapping) {
    for (const name of category.list ?? []) {
      if (!dirNames.has(name)) {
        fail(`categories-mapping.json：分类 ${category.key} 引用了不存在的插件目录 ${name}`);
      }
      mapped.add(name);
    }
  }
  for (const plugin of plugins) {
    if (!mapped.has(plugin.dirName)) {
      fail(`categories-mapping.json：插件 ${plugin.dirName} 没有归类（请加入某个分类的 list，或 other）`);
    }
  }
}

// ---------- 3) 构建产物与市场清单 ----------
const skipRelease = process.argv.includes('--skip-release');
const manifestPath = path.join(RELEASE_DIR, 'plugins.json');
if (skipRelease) {
  console.log('[verify] 跳过 release/ 校验（--skip-release）');
} else if (!fs.existsSync(manifestPath)) {
  fail('缺少 release/plugins.json（先跑 scripts/build-plugins.mjs 与 scripts/generate-plugins-json.mjs）');
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    fail('release/plugins.json 必须是非空数组');
  }
  const seen = new Set();
  for (const entry of manifest) {
    const label = `release/plugins.json:${entry.name}`;
    if (!isValidId(entry.name)) {
      fail(`${label}：市场主键必须是插件 id（反域名）`);
    }
    if (seen.has(entry.name)) {
      fail(`${label}：market 主键重复`);
    }
    seen.add(entry.name);
    if (!isValidVersion(entry.version)) {
      fail(`${label}：version 非法（${entry.version}）`);
    }
    if (!entry.downloadUrl) {
      fail(`${label}：缺少 downloadUrl`);
    }
    if (typeof entry.readme !== 'string' || entry.readme.trim() === '') {
      fail(`${label}：缺少 README 内容`);
    }
    const packagePath = path.join(RELEASE_DIR, entry.package ?? '');
    if (!entry.package || !fs.existsSync(packagePath)) {
      fail(`${label}：找不到对应的包 ${entry.package}`);
      continue;
    }
    const bytes = fs.readFileSync(packagePath);
    if (bytes.length !== entry.size) {
      fail(`${label}：${entry.package} 大小与清单不一致`);
    }
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== entry.sha256) {
      fail(`${label}：${entry.package} 的 sha256 与清单不一致`);
    }
    validatePackageEntries(packagePath, label);
    const embedded = readStoredEntry(packagePath, 'plugin.json');
    if (!embedded) {
      fail(`${label}：${entry.package} 内缺少 plugin.json`);
      continue;
    }
    const embeddedManifest = JSON.parse(embedded.toString('utf8'));
    if (embeddedManifest.id !== entry.name || embeddedManifest.version !== entry.version) {
      fail(
        `${label}：包内清单是 ${embeddedManifest.id}@${embeddedManifest.version}，与市场记录不符`
      );
    }
    validateManifest(embeddedManifest, `${label}#${entry.package}`);
    // 包里的清单必须与源码目录一致（防止"改了源码忘了重新打包"）。
    const source = plugins.find((plugin) => plugin.manifest.id === entry.name);
    if (!source) {
      fail(`${label}：plugins/ 下没有对应源码目录`);
    } else if (source.manifest.version !== entry.version) {
      fail(
        `${label}：源码版本 ${source.manifest.version} 与包版本 ${entry.version} 不一致（重新构建）`
      );
    }
  }
  for (const plugin of plugins) {
    if (!seen.has(plugin.manifest.id)) {
      fail(`release/plugins.json 缺少插件 ${plugin.manifest.id}（重新构建）`);
    }
  }

  // categories.json 与映射、与清单三方一致。
  const categoriesPath = path.join(RELEASE_DIR, 'categories.json');
  if (!fs.existsSync(categoriesPath)) {
    fail('缺少 release/categories.json');
  } else {
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    for (const category of categories) {
      for (const name of category.list ?? []) {
        if (!seen.has(name)) {
          fail(`release/categories.json：分类 ${category.key} 引用了清单里没有的插件 ${name}`);
        }
      }
      if (!fs.existsSync(path.join(REPO_ROOT, 'icons', `${category.key}.png`))) {
        fail(`release/categories.json：分类 ${category.key} 缺少 icons/${category.key}.png`);
      }
    }
  }
}

// ---------- 结果 ----------
if (problems.length > 0) {
  console.error(`[verify] 失败：${problems.length} 项`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}
console.log('[verify] 通过：插件清单、页面、分类映射、包结构与市场清单一致');
