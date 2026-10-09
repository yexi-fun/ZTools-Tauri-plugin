#!/usr/bin/env node
/**
 * 本地市场预览服务（零依赖，可选）。
 *
 * 为什么还需要它：仓库本身是"GitHub 公开仓库 + Release 资产"的形态，
 * 但 ZTools-Tauri 的市场客户端走的是 **HTTP 接口**（官方后端 z-tools.top）。
 * 这个脚本把 `release/plugins.json` 按客户端期待的接口形状暴露出来，
 * 用于本地联调 / 内网镜像；生产上你可以把它换成任意后端实现，只要接口形状一致。
 *
 * 用法：
 *   node scripts/build-plugins.mjs && node scripts/generate-plugins-json.mjs
 *   node server/serve.mjs --download-base /packages
 *   # 宿主（debug 构建）：
 *   set ZTOOLS_MARKET_API_BASE=http://127.0.0.1:8787
 *
 * 参数：
 *   --host <地址>          默认 127.0.0.1
 *   --port <端口>          默认 8787
 *   --download-base <前缀> 覆盖清单里的下载地址前缀（默认用清单里的 GitHub Release 地址）
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const RELEASE_DIR = path.join(REPO_ROOT, 'release');
const MANIFEST_PATH = path.join(RELEASE_DIR, 'plugins.json');
const CATEGORIES_PATH = path.join(RELEASE_DIR, 'categories.json');

/**
 * 解析命令行参数。
 * @param {string[]} argv 参数。
 * @returns {{host: string, port: number, downloadBase: string}} 配置。
 */
function parseArgs(argv) {
  const result = { host: '127.0.0.1', port: 8787, downloadBase: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--host') {
      result.host = argv[(index += 1)] ?? result.host;
    } else if (arg === '--port') {
      result.port = Number(argv[(index += 1)] ?? result.port);
    } else if (arg === '--download-base') {
      result.downloadBase = (argv[(index += 1)] ?? '').replace(/\/+$/, '');
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  if (!Number.isInteger(result.port) || result.port <= 0 || result.port > 65535) {
    throw new Error(`端口不合法：${result.port}`);
  }
  return result;
}

/**
 * 读取市场清单（每次请求都读，改完重跑生成脚本刷新页面即可生效）。
 * @returns {Array<object>} 插件记录数组。
 */
function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error('找不到 release/plugins.json，请先运行 scripts/build-plugins.mjs 与 scripts/generate-plugins-json.mjs');
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

/**
 * 读取分类数据。
 * @returns {Array<object>} 分类数组。
 */
function readCategories() {
  return fs.existsSync(CATEGORIES_PATH) ? JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8')) : [];
}

/**
 * 把仓库清单条目映射成市场客户端的 `MarketPlugin` 形状。
 * @param {object} entry 仓库清单条目。
 * @param {string} downloadBase 下载地址前缀覆盖（空串表示用清单里的地址）。
 * @returns {object} `MarketPlugin`。
 */
function toMarketPlugin(entry, downloadBase) {
  const url = entry.downloadUrl ?? '';
  return {
    name: entry.name,
    version: entry.version,
    title: entry.title ?? entry.name,
    description: entry.description ?? '',
    author: entry.author ?? '',
    logo: entry.logo ?? '',
    homepage: entry.homepage ?? '',
    size: entry.size ?? 0,
    downloadCount: 0,
    updatedAt: entry.publishedAt ?? 0,
    categoryTitle: categoryTitleOf(entry),
    // 根相对地址：宿主按 origin 解析（见 docs/市场仓库协议.md）。
    downloadUrl: downloadBase ? `${downloadBase}/${entry.package}` : url
  };
}

/**
 * 取插件的主分类标题（取第一个分类）。
 * @param {object} entry 仓库清单条目。
 * @returns {string} 分类标题。
 */
function categoryTitleOf(entry) {
  const key = (entry.categories ?? [])[0];
  if (!key) return '';
  return readCategories().find((category) => category.key === key)?.title ?? '';
}

/**
 * 发送 JSON 响应。
 * @param {http.ServerResponse} response 响应。
 * @param {number} status HTTP 状态码。
 * @param {unknown} payload 响应体。
 * @returns {void}
 */
function sendJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store'
  });
  response.end(body);
}

/**
 * 在 release/ 下安全解析一个相对路径。
 * @param {string} relative 相对路径。
 * @returns {string|null} 绝对路径；越界或不存在时返回 null。
 */
function resolveReleaseFile(relative) {
  const normalized = path.normalize(relative).replace(/^([/\\])+/, '');
  if (normalized.split(path.sep).some((segment) => segment === '..')) {
    return null;
  }
  const absolute = path.join(RELEASE_DIR, normalized);
  if (!absolute.startsWith(RELEASE_DIR + path.sep)) {
    return null;
  }
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? absolute : null;
}

const { host, port, downloadBase } = parseArgs(process.argv.slice(2));

const server = http.createServer((request, response) => {
  let url;
  try {
    url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  } catch {
    sendJson(response, 400, { error: '非法请求地址' });
    return;
  }
  const route = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: '只支持 GET' });
    return;
  }

  let manifest;
  try {
    manifest = readManifest();
  } catch (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  if (route === '/health') {
    sendJson(response, 200, { ok: true, pluginCount: manifest.length });
    return;
  }

  // 列表：宿主只取 latest 数组，再在本地按关键字过滤。
  if (route === '/plugins') {
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const latest = manifest
      .map((entry) => toMarketPlugin(entry, downloadBase))
      .slice(0, Number.isFinite(limit) && limit > 0 ? limit : manifest.length);
    sendJson(response, 200, {
      latest,
      categories: readCategories().map((category) => ({
        key: category.key,
        title: category.title,
        description: category.description,
        icon: category.icon
      })),
      banners: []
    });
    return;
  }

  // 详情：{ available, reason?, plugin }
  if (route === '/plugins/latest') {
    const name = url.searchParams.get('name') ?? '';
    const entry = manifest.find((item) => item.name === name);
    if (!entry) {
      sendJson(response, 404, { available: false, reason: 'not_found' });
      return;
    }
    sendJson(response, 200, { available: true, plugin: toMarketPlugin(entry, downloadBase) });
    return;
  }

  // README：{ content }
  if (route === '/plugins/readme') {
    const name = url.searchParams.get('name') ?? '';
    const entry = manifest.find((item) => item.name === name);
    if (!entry) {
      sendJson(response, 404, { error: '插件不存在' });
      return;
    }
    sendJson(response, 200, { content: entry.readme ?? '' });
    return;
  }

  // 版本历史：{ name, currentVersion, items }
  if (route === '/plugins/releases') {
    const name = url.searchParams.get('name') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const entry = manifest.find((item) => item.name === name);
    if (!entry) {
      sendJson(response, 404, { error: '插件不存在' });
      return;
    }
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const size = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const versions = entry.versions ?? [
      { version: entry.version, releaseNotes: entry.releaseNotes, publishedAt: entry.publishedAt }
    ];
    sendJson(response, 200, {
      name: entry.name,
      currentVersion: entry.version,
      items: versions.slice(start, start + size).map((item) => ({
        version: item.version,
        releaseNotes: item.releaseNotes ?? '',
        publishedAt: item.publishedAt ?? 0,
        sourceType: 'open_source'
      }))
    });
    return;
  }

  // 下载地址：{ zpxDownloadUrl }
  if (route === '/plugins/download') {
    const name = url.searchParams.get('name') ?? '';
    const entry = manifest.find((item) => item.name === name);
    if (!entry) {
      sendJson(response, 404, { error: '插件不存在' });
      return;
    }
    sendJson(response, 200, {
      zpxDownloadUrl: toMarketPlugin(entry, downloadBase).downloadUrl
    });
    return;
  }

  // 本地镜像模式：直接托管 release/ 下的包（配 --download-base /packages 使用）。
  if (route.startsWith('/packages/')) {
    // `/packages/<file>` → `release/<file>`（包就放在 release/ 根下，与 CI 上传的结构一致）。
    const absolute = resolveReleaseFile(decodeURIComponent(route.replace(/^\/packages\//, '')));
    if (!absolute) {
      sendJson(response, 404, { error: '文件不存在' });
      return;
    }
    const stat = fs.statSync(absolute);
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': stat.size,
      'last-modified': stat.mtime.toUTCString()
    });
    fs.createReadStream(absolute).pipe(response);
    return;
  }

  sendJson(response, 404, { error: `未知接口：${route}` });
});

server.listen(port, host, () => {
  console.log(`[market] 预览服务已启动：http://${host}:${port}`);
  console.log(`[market] 插件数：${readManifest().length}（来源 release/plugins.json）`);
  console.log('[market] 宿主（debug 构建）设置：');
  console.log(`  set ZTOOLS_MARKET_API_BASE=http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
  if (downloadBase) {
    console.log(`[market] 下载地址前缀已覆盖为：${downloadBase}`);
  }
});
