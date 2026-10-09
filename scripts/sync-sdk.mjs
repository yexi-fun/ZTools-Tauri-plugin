#!/usr/bin/env node
/**
 * 把 ZTools-Tauri 的插件 SDK 同步到每个插件的 `vendor/ztools-sdk/`。
 *
 * 为什么插件要自带 SDK：宿主只提供桥（`window.__ZTOOLS__` / Tauri IPC），
 * 不提供 SDK 文件；插件页面必须自己带着 SDK 一起发布（`.zpx` 里打进去），
 * 否则装到别人的机器上就 404。
 *
 * 来源优先级：
 * 1. `--sdk <目录>` 显式指定；
 * 2. 环境变量 `ZTOOLS_SDK_DIST`；
 * 3. 默认 `<仓库同级>/ZTools-Tauri/packages/ztools-sdk/dist`。
 *
 * 用法：
 *   node scripts/sync-sdk.mjs
 *   node scripts/sync-sdk.mjs --sdk E:\projectdata\ZTools-Tauri\packages\ztools-sdk\dist
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');

/**
 * 解析命令行参数。
 * @param {string[]} argv 参数。
 * @returns {{sdkDist: string}} 解析结果。
 */
function parseArgs(argv) {
  let sdkDist = process.env.ZTOOLS_SDK_DIST ?? '';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--sdk') {
      sdkDist = argv[(index += 1)] ?? '';
    } else {
      throw new Error(`未知参数：${argv[index]}`);
    }
  }
  if (!sdkDist) {
    sdkDist = path.resolve(REPO_ROOT, '..', 'ZTools-Tauri', 'packages', 'ztools-sdk', 'dist');
  }
  return { sdkDist: path.resolve(sdkDist) };
}

/**
 * 递归复制目录（跳过 `.map`，源码映射对插件运行时没意义，只会让包变大）。
 * @param {string} src 源目录。
 * @param {string} dest 目标目录。
 * @returns {number} 复制的文件数。
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.endsWith('.map')) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copied += copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

const { sdkDist } = parseArgs(process.argv.slice(2));
if (!fs.existsSync(path.join(sdkDist, 'index.js'))) {
  console.error(`找不到 SDK 产物（需要 index.js）：${sdkDist}`);
  console.error('提示：先在 ZTools-Tauri 里执行 `pnpm --filter @ztools/sdk build`，或用 --sdk 指定目录。');
  process.exit(1);
}

const plugins = fs
  .readdirSync(PLUGINS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

let total = 0;
for (const plugin of plugins) {
  const target = path.join(PLUGINS_DIR, plugin, 'vendor', 'ztools-sdk');
  const copied = copyDir(sdkDist, target);
  total += copied;
  console.log(`[sdk] ${plugin} ← ${path.relative(REPO_ROOT, target)}（${copied} 个文件）`);
}
console.log(`[sdk] 完成：${plugins.length} 个插件，共 ${total} 个文件（来源 ${sdkDist}）`);
