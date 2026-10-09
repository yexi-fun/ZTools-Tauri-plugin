#!/usr/bin/env node
/**
 * 检测本次提交改动了哪些插件，写出 `release/build-info.json`。
 *
 * 对应参考仓库的 `scripts/detect-changes.js`：CI 只构建"本次有改动的插件"，
 * 其余插件沿用上一次 Release 里的包（清单合并逻辑在 `generate-plugins-json.mjs`）。
 *
 * 用法：
 *   node scripts/detect-changes.mjs                 # 与 HEAD~1 比较（CI push 用）
 *   node scripts/detect-changes.mjs --base <ref>     # 指定比较基线
 *   node scripts/detect-changes.mjs --all            # 忽略 diff，全量构建
 *   node scripts/detect-changes.mjs --plugin a,b     # 只构建指定插件
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGINS_DIR_NAME, RELEASE_DIR_NAME, listPlugins } from './lib/repo.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

/**
 * 解析命令行参数。
 * @param {string[]} argv 参数。
 * @returns {{base: string, all: boolean, plugins: string[], releaseVersion: string}} 解析结果。
 */
function parseArgs(argv) {
  const today = new Date();
  const defaultVersion = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const result = { base: 'HEAD~1', all: false, plugins: [], releaseVersion: defaultVersion };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') {
      result.all = true;
    } else if (arg === '--base') {
      result.base = argv[(index += 1)] ?? result.base;
    } else if (arg === '--plugin') {
      result.plugins = (argv[(index += 1)] ?? '')
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg === '--release-version') {
      result.releaseVersion = argv[(index += 1)] ?? result.releaseVersion;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return result;
}

/**
 * 执行 git 并返回标准输出（失败时返回空串，例如只有一个提交的仓库）。
 * @param {string[]} args git 参数。
 * @returns {string} 输出。
 */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    return '';
  }
}

const { base, all, plugins, releaseVersion } = parseArgs(process.argv.slice(2));
const allPlugins = listPlugins(REPO_ROOT);
const knownDirs = new Set(allPlugins.map((plugin) => plugin.dirName));

let changedPlugins = [];
let deletedPlugins = [];

if (all) {
  changedPlugins = [...knownDirs];
} else if (plugins.length > 0) {
  for (const name of plugins) {
    if (!knownDirs.has(name)) {
      console.warn(`[detect] 忽略未知插件：${name}`);
      continue;
    }
    changedPlugins.push(name);
  }
} else {
  // 首次推送（仓库只有一个提交）时没有可比的基线：直接全量构建，
  // 否则 CI 会认为"没有变动"从而永远发不出第一个 Release。
  const hasBase = git(['rev-parse', '--verify', base]).trim() !== '';
  if (!hasBase) {
    console.log(`[detect] 找不到基线 ${base}（首次推送？）→ 按全量构建`);
    changedPlugins = [...knownDirs];
  }
  // 变更文件形如 `plugins/<目录>/...`；删除目录也要识别出来（用于从清单里剔除）。
  const nameStatus = hasBase ? git(['diff', '--name-status', `${base}..HEAD`]) : '';
  if (!nameStatus.trim()) {
    if (changedPlugins.length === 0) {
      // 退回"工作区 vs HEAD"（本地手跑时的常见场景）。
      const local = git(['status', '--porcelain']);
      for (const line of local.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const file = line.slice(3).trim();
        const match = file.match(new RegExp(`^${PLUGINS_DIR_NAME}/([^/]+)/`));
        if (match && knownDirs.has(match[1])) {
          changedPlugins.push(match[1]);
        }
      }
    }
  } else {
    for (const line of nameStatus.split(/\r?\n/)) {
      const [status, file] = line.split(/\s+/);
      if (!file) continue;
      const match = file.match(new RegExp(`^${PLUGINS_DIR_NAME}/([^/]+)(/|$)`));
      if (!match) continue;
      const dirName = match[1];
      if (status.startsWith('D') && !knownDirs.has(dirName)) {
        deletedPlugins.push(dirName);
      } else if (knownDirs.has(dirName)) {
        changedPlugins.push(dirName);
      }
    }
  }
}

changedPlugins = [...new Set(changedPlugins)].sort();
deletedPlugins = [...new Set(deletedPlugins)].sort();

const releaseDir = path.join(REPO_ROOT, RELEASE_DIR_NAME);
fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(
  path.join(releaseDir, 'build-info.json'),
  `${JSON.stringify(
    {
      releaseVersion,
      buildAll: all,
      changedPlugins,
      deletedPlugins,
      generatedAt: Date.now()
    },
    null,
    2
  )}\n`
);

console.log(`[detect] 发布版本：v${releaseVersion}`);
console.log(`[detect] 待构建插件（${changedPlugins.length}）：${changedPlugins.join(', ') || '无'}`);
if (deletedPlugins.length > 0) {
  console.log(`[detect] 已删除插件：${deletedPlugins.join(', ')}`);
}
console.log('[detect] 已写入 release/build-info.json');
