#!/usr/bin/env node
/**
 * 由 `release/*.zpx` 生成市场清单 `release/plugins.json` 与 `release/categories.json`。
 *
 * 对齐参考仓库 `scripts/generate-plugins-json.js` 的做法与字段：
 * - 每个 `.zpx` → 一条插件记录：清单字段 + `downloadUrl` + `logo`（内嵌 base64）+ `size`；
 * - 插件记录里额外带上 `sha256` / `readme` / `changelog` / `releaseNotes`，
 *   供市场详情页使用（宿主会忽略用不到的字段）；
 * - `categories.json` 由根目录 `categories-mapping.json` 与插件的 `categories` 字段合并生成。
 *
 * 与参考仓库的差异：包是 `.zpx`、下载地址后缀也是 `.zpx`，且市场主键是插件 **id**
 * （ZTools-Tauri 的注册表 id），而不是目录名。
 *
 * 用法：
 *   node scripts/generate-plugins-json.mjs
 *   node scripts/generate-plugins-json.mjs --release-version 2026.10.09
 *   node scripts/generate-plugins-json.mjs --download-base http://127.0.0.1:8787/packages
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLUGINS_DIR_NAME,
  RELEASE_DIR_NAME,
  detectRepo,
  latestReleaseNotes,
  listPlugins,
  readBuildInfo,
  readTextIfExists
} from './lib/repo.mjs';
import { readStoredEntry } from './lib/zip.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const RELEASE_DIR = path.join(REPO_ROOT, RELEASE_DIR_NAME);
const CATEGORIES_MAPPING_FILE = path.join(REPO_ROOT, 'categories-mapping.json');
/** 上一次发布的市场清单（CI 从最近一次 Release 下载到这里；本地增量构建则沿用 release/plugins.json）。 */
const PREVIOUS_MANIFEST_FILE = path.join(RELEASE_DIR, 'plugins.previous.json');

/**
 * 解析命令行参数。
 * @param {string[]} argv 参数。
 * @returns {{releaseVersion: string, downloadBase: string}} 解析结果。
 */
function parseArgs(argv) {
  const result = { releaseVersion: '', downloadBase: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--release-version') {
      result.releaseVersion = argv[(index += 1)] ?? '';
    } else if (arg === '--download-base') {
      result.downloadBase = (argv[(index += 1)] ?? '').replace(/\/+$/, '');
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

/**
 * 从 zip 里读出一个条目的文本。
 * @param {string} zipPath 包路径。
 * @param {string} entryName 条目名。
 * @returns {string|null} 文本；条目不存在时返回 null。
 */
function readTextFromZip(zipPath, entryName) {
  const buffer = readStoredEntry(zipPath, entryName);
  return buffer ? buffer.toString('utf8') : null;
}

/**
 * 把一条插件记录压成"版本条目"（写进 `versions` 历史，供市场展示版本列表）。
 * @param {object} entry 插件记录。
 * @returns {object} 版本条目。
 */
function versionEntry(entry) {
  return {
    version: entry.version,
    downloadUrl: entry.downloadUrl,
    package: entry.package,
    size: entry.size,
    sha256: entry.sha256,
    publishedAt: entry.publishedAt,
    releaseNotes: entry.releaseNotes
  };
}

const { releaseVersion: versionArg, downloadBase: downloadBaseArg } = parseArgs(process.argv.slice(2));
const buildInfo = readBuildInfo(REPO_ROOT);
const releaseVersion = versionArg || buildInfo?.releaseVersion || 'latest';

if (!fs.existsSync(RELEASE_DIR)) {
  console.error('找不到 release/ 目录，请先运行 scripts/build-plugins.mjs');
  process.exit(1);
}

const packages = fs
  .readdirSync(RELEASE_DIR)
  .filter((file) => file.endsWith('.zpx'))
  .sort();
if (packages.length === 0) {
  console.error('release/ 下没有任何 .zpx，请先运行 scripts/build-plugins.mjs');
  process.exit(1);
}

// id → 插件目录：用于回填 README / CHANGELOG / 分类。
const pluginsByDir = new Map(listPlugins(REPO_ROOT).map((plugin) => [plugin.dirName, plugin]));
const pluginsById = new Map(
  [...pluginsByDir.values()].map((plugin) => [plugin.manifest.id, plugin])
);

// 分类映射：`list` 里写的是**插件目录名**（与参考仓库一致），这里反查成 id。
const categoriesMapping = JSON.parse(fs.readFileSync(CATEGORIES_MAPPING_FILE, 'utf8'));
const categoryOf = new Map();
for (const category of categoriesMapping) {
  for (const dirName of category.list ?? []) {
    const plugin = pluginsByDir.get(dirName);
    const key = plugin?.manifest.id ?? dirName;
    if (!categoryOf.has(key)) {
      categoryOf.set(key, []);
    }
    categoryOf.get(key).push(category.key);
  }
}

// 下载地址：CI 里指向本次 Release 的资产；本地可用 --download-base 指到自己的静态服务。
const repo = detectRepo(REPO_ROOT, process.env.ZTOOLS_PLUGINS_REPO ?? '');
if (!repo && !downloadBaseArg) {
  console.warn('[generate] 无法识别 GitHub 仓库（没有 GITHUB_REPOSITORY 也没有 git remote），');
  console.warn('           将用相对路径生成 downloadUrl；发布前请设置 ZTOOLS_PLUGINS_REPO=owner/repo。');
}

const plugins = [];
for (const file of packages) {
  const fullPath = path.join(RELEASE_DIR, file);
  const manifestText = readTextFromZip(fullPath, 'plugin.json');
  if (!manifestText) {
    console.error(`[generate] ${file} 里没有 plugin.json，已跳过`);
    continue;
  }
  const manifest = JSON.parse(manifestText);
  const source = pluginsById.get(manifest.id);
  const bytes = fs.readFileSync(fullPath);
  const downloadUrl = downloadBaseArg
    ? `${downloadBaseArg}/${file}`
    : repo
      ? `https://github.com/${repo.owner}/${repo.repo}/releases/download/v${releaseVersion}/${file}`
      : `./${file}`;

  // logo 内嵌成 base64（与参考仓库一致）：市场页面无需再请求插件资源。
  let logo = manifest.logo ?? null;
  if (manifest.logo) {
    const logoBuffer = readStoredEntry(fullPath, manifest.logo);
    if (logoBuffer) {
      logo = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn(`[generate] ${manifest.id} 的包内找不到 logo（${manifest.logo}）`);
    }
  }

  const changelog = source ? readTextIfExists(path.join(source.path, 'CHANGELOG.md')) : '';
  plugins.push({
    name: manifest.id,
    title: manifest.title ?? manifest.name ?? manifest.id,
    version: manifest.version,
    description: manifest.description ?? '',
    author: manifest.author ?? '',
    homepage: '',
    categories: categoryOf.get(manifest.id) ?? [],
    logo,
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    downloadUrl,
    package: file,
    readme: source ? readTextIfExists(path.join(source.path, 'README.md')) : '',
    changelog,
    releaseNotes: latestReleaseNotes(changelog),
    // 必须是整数毫秒：宿主把 `updatedAt` / `publishedAt` 当 u64 反序列化，
    // `fs.statSync().mtimeMs` 是浮点数，直接写进去会让整个市场响应被判为非法。
    publishedAt: Math.floor(fs.statSync(fullPath).mtimeMs)
  });
  console.log(`[generate] ${manifest.id}@${manifest.version} → ${file}（${bytes.length} 字节）`);
}

if (plugins.length === 0) {
  console.error('[generate] 没有生成任何插件记录');
  process.exit(1);
}

// ---------- 与上一次清单合并 ----------
// 为什么必须合并：CI 只构建"本次有改动的插件"，未变动的插件不在 release/ 里出现；
// 若直接覆盖清单，它们会从市场里消失（参考仓库用 plugins.previous.json 做同一件事）。
// 合并规则与参考仓库一致：本次构建的插件用新条目，其余沿用旧条目（含旧的 downloadUrl）。
const manifestPath = path.join(RELEASE_DIR, 'plugins.json');
const previous = fs.existsSync(PREVIOUS_MANIFEST_FILE)
  ? JSON.parse(fs.readFileSync(PREVIOUS_MANIFEST_FILE, 'utf8'))
  : fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : [];
const deletedDirs = new Set(buildInfo?.deletedPlugins ?? []);
const deletedIds = new Set(
  [...deletedDirs].map((dirName) => pluginsByDir.get(dirName)?.manifest.id ?? dirName)
);

const builtNames = new Set(plugins.map((plugin) => plugin.name));
const merged = plugins.map((plugin) => {
  const before = previous.find((entry) => entry.name === plugin.name);
  if (!before) {
    return { ...plugin, versions: [versionEntry(plugin)] };
  }
  // 版本没变（例如只改了 README）：保留旧下载地址，避免指向不存在的资产。
  // 例外：`--download-base` 是"本地镜像"模式，此时下载地址要按镜像重写，不能沿用旧条目。
  if (before.version === plugin.version && !downloadBaseArg) {
    return before;
  }
  const history = (before.versions ?? [versionEntry(before)]).filter(
    (item) => item.version !== plugin.version
  );
  return { ...plugin, versions: [versionEntry(plugin), ...history] };
});

for (const entry of previous) {
  if (builtNames.has(entry.name) || deletedIds.has(entry.name)) continue;
  merged.push(entry);
}
merged.sort((left, right) => left.name.localeCompare(right.name));

// categories.json：分类定义 + 命中该分类的插件 id 列表（参考仓库同构，基于合并后的清单）。
const categories = categoriesMapping.map((category) => ({
  key: category.key,
  title: category.title,
  description: category.description ?? '',
  icon: category.icon ?? '',
  list: merged
    .filter((plugin) => (plugin.categories ?? []).includes(category.key))
    .map((plugin) => plugin.name)
}));

fs.writeFileSync(manifestPath, `${JSON.stringify(merged, null, 2)}\n`);
fs.writeFileSync(path.join(RELEASE_DIR, 'categories.json'), `${JSON.stringify(categories, null, 2)}\n`);

console.log(`[generate] release/plugins.json：本次 ${plugins.length} 个，合并后 ${merged.length} 个插件`);
console.log(`[generate] release/categories.json：${categories.length} 个分类`);
console.log(`[generate] 发布版本：v${releaseVersion}`);
