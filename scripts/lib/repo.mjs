/**
 * 仓库级公共工具：读取插件目录、清单、构建信息。
 *
 * 这些函数同时被构建、生成市场清单与自检脚本使用，避免三处各写一份解析逻辑
 * （参考仓库 ZToolsCenter/ZTools-plugins 也是同样的分工）。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** 插件源码目录名。 */
export const PLUGINS_DIR_NAME = 'plugins';

/** 构建产物目录名（`.zpx` 与市场清单，CI 上传到 Release）。 */
export const RELEASE_DIR_NAME = 'release';

/**
 * 列出所有插件目录。
 * @param {string} repoRoot 仓库根目录。
 * @returns {Array<{dir: string, dirName: string, path: string, manifest: object}>} 插件列表（按目录名排序）。
 */
export function listPlugins(repoRoot) {
  const pluginsRoot = path.join(repoRoot, PLUGINS_DIR_NAME);
  if (!fs.existsSync(pluginsRoot)) {
    return [];
  }
  return fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(pluginsRoot, name, 'plugin.json')))
    .sort()
    .map((dirName) => ({
      dirName,
      dir: dirName,
      path: path.join(pluginsRoot, dirName),
      manifest: readManifest(path.join(pluginsRoot, dirName))
    }));
}

/**
 * 读取插件清单。
 * @param {string} pluginDir 插件目录。
 * @returns {object} 清单对象。
 */
export function readManifest(pluginDir) {
  return JSON.parse(fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8'));
}

/**
 * 读取可选文本文件。
 * @param {string} file 文件路径。
 * @returns {string} 内容；文件不存在时返回空串。
 */
export function readTextIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/**
 * 读取构建信息（由 `detect-changes.mjs` 生成）。
 * @param {string} repoRoot 仓库根目录。
 * @returns {object|null} 构建信息；文件不存在时返回 null。
 */
export function readBuildInfo(repoRoot) {
  const file = path.join(repoRoot, RELEASE_DIR_NAME, 'build-info.json');
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * 从 CHANGELOG.md 里取"最新一段"作为发布说明。
 *
 * 约定：`## <版本> - <日期>` 作为一节的开头（参考仓库的 CHANGELOG 就是这个格式）。
 * @param {string} changelog CHANGELOG 文本。
 * @returns {string} 最新一节的正文；取不到时返回空串。
 */
export function latestReleaseNotes(changelog) {
  if (!changelog) return '';
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+\S/.test(line.trim()));
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s+\S/.test(line.trim()));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * 解析仓库的 GitHub owner/repo。
 *
 * 优先用 CI 注入的 `GITHUB_REPOSITORY`，其次读本地 git remote，
 * 都拿不到时回退到 `--owner/--repo`（调用方传入）。
 * @param {string} repoRoot 仓库根目录。
 * @param {string} [fallback] 兜底值，形如 `owner/repo`。
 * @returns {{owner: string, repo: string}|null} 仓库信息。
 */
export function detectRepo(repoRoot, fallback = '') {
  const fromEnv = process.env.GITHUB_REPOSITORY ?? '';
  const candidate = fromEnv || fallback;
  if (candidate.includes('/')) {
    const [owner, repo] = candidate.split('/');
    if (owner && repo) {
      return { owner, repo };
    }
  }
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
    const match = remote.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // 没有 git remote：返回 null，由调用方决定兜底策略。
  }
  return null;
}
