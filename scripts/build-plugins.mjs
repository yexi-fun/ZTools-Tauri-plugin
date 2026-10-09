#!/usr/bin/env node
/**
 * 把插件目录打包成 `.zpx` 放进 `release/`。
 *
 * **这是与参考仓库唯一的实质差异**：ZToolsCenter/ZTools-plugins 产出的是 ZTools
 * Electron 的插件 zip（v1 清单 + preload.js），ZTools-Tauri 安装的是 **`.zpx`**
 * （zip 容器 + schema 2 清单 + 自带 SDK），因此这里换成 ZTools-Tauri 的打包器。
 * 其余（目录结构、Release 命名、清单字段）与参考仓库保持一致。
 *
 * 用法：
 *   node scripts/build-plugins.mjs              # 按 release/build-info.json 构建变动插件
 *   node scripts/build-plugins.mjs --all        # 全量构建
 *   node scripts/build-plugins.mjs --plugin text-toolkit,quick-note
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_DIR_NAME, listPlugins, readBuildInfo } from './lib/repo.mjs';
import { packDirectory } from './lib/zip.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const RELEASE_DIR = path.join(REPO_ROOT, RELEASE_DIR_NAME);

/**
 * 解析命令行参数。
 * @param {string[]} argv 参数。
 * @returns {{all: boolean, plugins: string[]}} 解析结果。
 */
function parseArgs(argv) {
  const result = { all: false, plugins: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      result.all = true;
    } else if (arg === '--plugin') {
      result.plugins = (argv[(index += 1)] ?? '')
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

const { all, plugins } = parseArgs(process.argv.slice(2));
const allPlugins = listPlugins(REPO_ROOT);
if (allPlugins.length === 0) {
  console.error('plugins/ 下没有找到任何插件');
  process.exit(1);
}

let targets = allPlugins;
if (!all && plugins.length === 0) {
  const buildInfo = readBuildInfo(REPO_ROOT);
  if (buildInfo) {
    const wanted = new Set(buildInfo.changedPlugins ?? []);
    targets = allPlugins.filter((plugin) => wanted.has(plugin.dirName));
    console.log(
      `[build] 依据 build-info.json 构建 ${targets.length} 个插件（发布版本 v${buildInfo.releaseVersion}）`
    );
  } else {
    console.log('[build] 没有 build-info.json，按全量构建');
  }
} else if (plugins.length > 0) {
  const wanted = new Set(plugins);
  targets = allPlugins.filter((plugin) => wanted.has(plugin.dirName));
}

if (targets.length === 0) {
  console.log('[build] 本次没有需要构建的插件');
  process.exit(0);
}

fs.mkdirSync(RELEASE_DIR, { recursive: true });

let totalBytes = 0;
const built = [];
for (const plugin of targets) {
  const { id, version } = plugin.manifest;
  if (!id || !version) {
    console.error(`[build] ${plugin.dirName} 的 plugin.json 缺少 id 或 version`);
    process.exit(1);
  }
  // 包名与参考仓库同构：`<插件名>-<版本>.zpx`；ZTools-Tauri 侧用 **插件 id** 作市场主键，
  // 因此这里直接用 id，避免市场键与注册表 id 不一致。
  const fileName = `${id}-${version}.zpx`;
  const output = path.join(RELEASE_DIR, fileName);
  const result = packDirectory(plugin.path, output);
  totalBytes += result.bytes;
  built.push({ id, version, fileName, bytes: result.bytes });
  console.log(`[build] ${plugin.dirName} → ${fileName}（${result.files} 个文件，${result.bytes} 字节）`);
}

console.log(`[build] 完成：${built.length} 个包，共 ${(totalBytes / 1024).toFixed(1)} KiB`);
