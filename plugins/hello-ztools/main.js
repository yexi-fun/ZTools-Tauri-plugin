/**
 * Hello ZTools —— 最小可用插件。
 *
 * 演示四件事，正好覆盖写插件时最常用的路径：
 * 1. `bootstrap()` 注册生命周期（`onEnter` 拿主面板输入文本，`onExit` 收尾）；
 * 2. 通过 `ztools.*` 调用宿主能力（剪贴板 / 私有存储 / 通知）；
 * 3. 处理权限错误：未声明的能力会被宿主拒绝，插件要能优雅提示；
 * 4. 自带 SDK：`vendor/ztools-sdk/` 随插件一起发布，不依赖宿主提供文件。
 */
import { bootstrap, ztools, ZToolsApiError } from './vendor/ztools-sdk/index.js';

/** 进入载荷展示区。 */
const enterElement = document.querySelector('#enter');

/** 日志区。 */
const logElement = document.querySelector('#log');

/**
 * 追加一行日志。
 * @param {string} message 文本。
 * @param {'ok'|'error'} [kind] 样式类别。
 * @returns {void}
 */
function log(message, kind) {
  const line = document.createElement('div');
  if (kind) {
    line.className = kind;
  }
  line.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  logElement.appendChild(line);
}

/**
 * 统一包装能力调用：把宿主抛出的错误解释成人话。
 * @param {() => Promise<unknown>} action 能力调用。
 * @param {string} label 动作名。
 * @returns {Promise<unknown>} 调用结果；失败时返回 null。
 */
async function attempt(action, label) {
  try {
    const result = await action();
    log(`${label} → ${JSON.stringify(result ?? null)}`, 'ok');
    return result;
  } catch (error) {
    // 宿主拒绝能力时会抛 ZToolsApiError（kind=permissionDenied / invalidArgument …）。
    if (error instanceof ZToolsApiError) {
      log(`${label} 被拒绝：${error.kind} ${error.message}`, 'error');
    } else {
      log(`${label} 失败：${error?.message ?? error}`, 'error');
    }
    return null;
  }
}

/** 把一段文本转成大写。 */
function toUpper(text) {
  return text.toUpperCase();
}

document.querySelector('#btn-upper').addEventListener('click', async () => {
  const text = await attempt(() => ztools.clipboard.readText(), 'clipboard.readText');
  if (typeof text !== 'string') return;
  await attempt(() => ztools.clipboard.writeText(toUpper(text)), 'clipboard.writeText');
});

document.querySelector('#btn-count').addEventListener('click', async () => {
  const current = (await attempt(() => ztools.storage.get('runs'), 'storage.get')) ?? 0;
  const next = Number(current) + 1;
  await attempt(() => ztools.storage.set('runs', next), 'storage.set');
});

document.querySelector('#btn-storage').addEventListener('click', async () => {
  const entries = await attempt(() => ztools.storage.list(), 'storage.list');
  if (Array.isArray(entries) && entries.length === 0) {
    log('私有存储还是空的', 'ok');
  }
});

document.querySelector('#btn-toast').addEventListener('click', async () => {
  await attempt(
    () => ztools.ui.showNotification({ title: 'Hello ZTools', body: '这条通知来自示例插件' }),
    'ui.showNotification'
  );
});

document.querySelector('#btn-exit').addEventListener('click', () => {
  ztools.exit();
});

bootstrap({
  /**
   * 主面板命中本插件的 feature 时进入插件。
   * @param {{kind: string, payload?: unknown}} event 生命周期事件。
   * @returns {void}
   */
  onEnter(event) {
    enterElement.textContent = JSON.stringify(event, null, 2);
    log(`onEnter kind=${event.kind}`, 'ok');
    // `over` 指令的载荷就是主面板输入框文本：这里直接把结果显示给用户。
    if (typeof event.payload === 'string' && event.payload.trim() !== '') {
      log(`输入文本转大写 → ${toUpper(event.payload)}`, 'ok');
    }
  },

  /**
   * 插件退出（用户切换插件、面板关闭或调用 `ztools.exit()`）。
   * @returns {void}
   */
  onExit() {
    log('onExit：插件已退出');
  }
});

log('插件页面已加载，等待主面板唤入', 'ok');
