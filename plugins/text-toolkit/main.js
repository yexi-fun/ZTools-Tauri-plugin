/**
 * 文本工具箱 —— 多 feature 插件示例。
 *
 * 与 `hello-ztools` 的差别：
 * - 一个插件声明了 5 个 feature，其中 4 个是 `over`（按输入长度触发）、
 *   1 个是 `regex`（输入看起来是链接时才出现）；
 * - 进入时按 `event.payload` 预填源文本；`regex` 指令会直接把链接当载荷送进来；
 * - 用私有存储保存"最近 5 次结果"，演示 storage 的读写与列表。
 */
import { bootstrap, ztools, ZToolsApiError } from './vendor/ztools-sdk/index.js';

/** 进入摘要。 */
const enterSummary = document.querySelector('#enter-summary');

/** 源文本 / 结果 / 日志元素。 */
const source = document.querySelector('#source');
const result = document.querySelector('#result');
const logElement = document.querySelector('#log');
const sourceStats = document.querySelector('#source-stats');
const resultStats = document.querySelector('#result-stats');

/** 最近结果的存储键。 */
const HISTORY_KEY = 'recent-results';

/** 最近结果最多保留多少条。 */
const HISTORY_LIMIT = 5;

/**
 * 追加日志。
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
 * 统一包装宿主能力调用。
 * @param {() => Promise<unknown>} action 调用。
 * @param {string} label 动作名。
 * @returns {Promise<unknown>} 结果或 null。
 */
async function attempt(action, label) {
  try {
    const value = await action();
    log(`${label} → ok`, 'ok');
    return value;
  } catch (error) {
    const detail = error instanceof ZToolsApiError ? `${error.kind} ${error.message}` : String(error);
    log(`${label} 失败：${detail}`, 'error');
    return null;
  }
}

/**
 * 统计一段文本。
 * @param {string} text 文本。
 * @returns {{chars: number, words: number, lines: number}} 统计结果。
 */
function measure(text) {
  const trimmed = text.trim();
  return {
    chars: text.length,
    words: trimmed === '' ? 0 : trimmed.split(/\s+/).length,
    lines: text === '' ? 0 : text.split(/\r?\n/).length
  };
}

/**
 * 刷新"源 / 结果"右下角的统计文案。
 * @returns {void}
 */
function refreshStats() {
  const sourceStat = measure(source.value);
  sourceStats.textContent = `${sourceStat.chars} 字符 / ${sourceStat.words} 词 / ${sourceStat.lines} 行`;
  const resultStat = measure(result.value);
  resultStats.textContent = result.value
    ? `${resultStat.chars} 字符 / ${resultStat.words} 词 / ${resultStat.lines} 行`
    : '';
}

/** 各操作的具体实现（纯函数，方便单独测试）。 */
const operations = {
  /**
   * 转大写。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  upper: (text) => text.toUpperCase(),
  /**
   * 转小写。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  lower: (text) => text.toLowerCase(),
  /**
   * 清理：去掉行尾空白、合并连续空行、去掉首尾空行。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  clean: (text) =>
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  /**
   * 行去重（保留首次出现顺序，忽略首尾空白相同的行）。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  dedup: (text) => {
    const seen = new Set();
    return text
      .split(/\r?\n/)
      .filter((line) => {
        const key = line.trim();
        if (key === '') return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join('\n');
  },
  /**
   * 反转行序。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  reverse: (text) => text.split(/\r?\n/).reverse().join('\n'),
  /**
   * 统计信息（当结果展示）。
   * @param {string} text 文本。
   * @returns {string} 结果。
   */
  stats: (text) => {
    const stat = measure(text);
    const longest = text
      .split(/\r?\n/)
      .reduce((max, line) => Math.max(max, line.length), 0);
    return [`字符数：${stat.chars}`, `词数：${stat.words}`, `行数：${stat.lines}`, `最长行：${longest}`].join(
      '\n'
    );
  }
};

/**
 * 把一次结果追加进"最近结果"。
 * @param {string} op 操作名。
 * @param {string} text 结果文本。
 * @returns {Promise<void>} 写完后结束。
 */
async function pushHistory(op, text) {
  const current = (await attempt(() => ztools.storage.get(HISTORY_KEY), 'storage.get')) ?? [];
  const next = [{ op, text, at: Date.now() }, ...(Array.isArray(current) ? current : [])].slice(
    0,
    HISTORY_LIMIT
  );
  await attempt(() => ztools.storage.set(HISTORY_KEY, next), 'storage.set');
}

/**
 * 执行一个操作并把结果写进结果框。
 * @param {string} op 操作名。
 * @returns {Promise<void>} 完成后结束。
 */
async function runOperation(op) {
  const handler = operations[op];
  if (!handler) {
    log(`未知操作：${op}`, 'error');
    return;
  }
  result.value = handler(source.value);
  refreshStats();
  await pushHistory(op, result.value);
}

source.addEventListener('input', refreshStats);
result.addEventListener('input', refreshStats);

document.querySelector('#operations').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-op]');
  if (!button) return;
  void runOperation(button.dataset.op);
});

document.querySelector('#btn-read').addEventListener('click', async () => {
  const text = await attempt(() => ztools.clipboard.readText(), 'clipboard.readText');
  if (typeof text === 'string') {
    source.value = text;
    refreshStats();
  }
});

document.querySelector('#btn-apply-enter').addEventListener('click', () => {
  void runOperation(currentIntent);
});

document.querySelector('#btn-copy').addEventListener('click', async () => {
  if (!result.value) {
    log('结果为空，先执行一个操作', 'error');
    return;
  }
  await attempt(() => ztools.clipboard.writeText(result.value), 'clipboard.writeText');
  await attempt(
    () => ztools.ui.showNotification({ title: '文本工具箱', body: '结果已写回剪贴板' }),
    'ui.showNotification'
  );
});

document.querySelector('#btn-apply-result').addEventListener('click', () => {
  source.value = result.value;
  refreshStats();
});

document.querySelector('#btn-history').addEventListener('click', async () => {
  const history = await attempt(() => ztools.storage.get(HISTORY_KEY), 'storage.get');
  log(`最近结果：${JSON.stringify(history ?? [], null, 2)}`, 'ok');
});

document.querySelector('#btn-open-url').addEventListener('click', async () => {
  const candidate = (source.value.trim() || result.value.trim()).split(/\s+/)[0];
  if (!/^https?:\/\//i.test(candidate)) {
    log('源文本里没有 http(s) 链接', 'error');
    return;
  }
  // `shell.openExternal` 只放行 http/https/mailto/tel（宿主白名单），其它协议会被拒绝。
  await attempt(() => ztools.shell.openExternal(candidate), 'shell.openExternal');
});

/** 本次进入的默认操作（由 feature 决定）。 */
let currentIntent = 'clean';

/** feature code → 进入后默认执行的操作。 */
const featureIntent = {
  'text.upper': 'upper',
  'text.lower': 'lower',
  'text.clean': 'clean',
  'text.dedup': 'dedup',
  'text.stats': 'stats',
  'text.open-url': 'stats'
};

bootstrap({
  /**
   * 主面板命中 feature 时进入。
   * @param {{kind?: string, code?: string, payload?: unknown}} event 生命周期事件。
   * @returns {void}
   */
  onEnter(event) {
    const code = event.code ?? 'text.clean';
    currentIntent = featureIntent[code] ?? 'clean';
    enterSummary.textContent = `由 ${code} 进入 · 默认操作：${currentIntent}`;
    if (typeof event.payload === 'string' && event.payload !== '') {
      source.value = event.payload;
      // 进入即执行默认操作：用户在主面板敲「行去重」就只想拿到去重结果。
      void runOperation(currentIntent);
    }
    refreshStats();
  },

  /**
   * 退出时把结果落盘，便于下次直接复用。
   * @returns {void}
   */
  onExit() {
    log('onExit：结果已保留在私有存储的 recent-results 里');
  }
});

refreshStats();
log('文本工具箱已就绪：源文本支持主面板输入、剪贴板与手工编辑', 'ok');
