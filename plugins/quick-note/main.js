/**
 * 速记本 —— 文件与授权流程示例。
 *
 * 关键点：
 * - 插件**不能**凭空读写任意路径：`ztools.fs.*` 只允许访问用户经系统对话框
 *   授权过的范围（`docs/插件开发指南.md` 的"文件访问"一节）；
 * - `fs.read.any` / `fs.write.any` 属于高风险权限，**首次调用**宿主会弹一次确认框；
 *   用户拒绝会抛 `permissionDenied`，插件必须能兜住；
 * - 记住上次选择的文件可放进插件私有存储（`storage`，默认允许，无需授权）。
 */
import { bootstrap, ztools, ZToolsApiError } from './vendor/ztools-sdk/index.js';

/** 进入摘要与统计。 */
const enterSummary = document.querySelector('#enter-summary');
const noteElement = document.querySelector('#note');
const noteStats = document.querySelector('#note-stats');
const fileHint = document.querySelector('#file-hint');
const previewElement = document.querySelector('#preview');
const previewStats = document.querySelector('#preview-stats');
const logElement = document.querySelector('#log');

/** 私有存储里记录"上次用过的笔记文件"。 */
const FILE_KEY = 'note-file';

/** 当前笔记文件路径（来自对话框或私有存储）。 */
let noteFile = null;

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
 * 刷新界面上的统计与文件提示。
 * @returns {void}
 */
function refresh() {
  noteStats.textContent = `${noteElement.value.length} 字符`;
  fileHint.textContent = noteFile ?? '未选择（首次选择会请求文件读写授权）';
  previewStats.textContent = previewElement.textContent.startsWith('（')
    ? ''
    : `${previewElement.textContent.length} 字符`;
}

/**
 * 记下并回显当前文件。
 * @param {string|null} path 文件路径。
 * @returns {Promise<void>} 写完后结束。
 */
async function rememberFile(path) {
  noteFile = path;
  if (path) {
    await attempt(() => ztools.storage.set(FILE_KEY, path), 'storage.set');
  } else {
    await attempt(() => ztools.storage.remove(FILE_KEY), 'storage.remove');
  }
  refresh();
}

document.querySelector('#btn-clip').addEventListener('click', async () => {
  const text = await attempt(() => ztools.clipboard.readText(), 'clipboard.readText');
  if (typeof text === 'string') {
    noteElement.value = noteElement.value ? `${noteElement.value}\n${text}` : text;
    refresh();
  }
});

document.querySelector('#btn-write-clip').addEventListener('click', async () => {
  if (!noteElement.value) {
    log('待写入内容为空', 'error');
    return;
  }
  await attempt(() => ztools.clipboard.writeText(noteElement.value), 'clipboard.writeText');
});

document.querySelector('#btn-choose').addEventListener('click', async () => {
  // 保存对话框只返回用户确认的路径，不会真的写文件；真正落盘由 fs.writeText 完成。
  const path = await attempt(
    () =>
      ztools.dialog.saveFile({
        title: '选择或新建笔记文件',
        defaultPath: 'notes.md',
        filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }]
      }),
    'dialog.saveFile'
  );
  if (typeof path === 'string' && path) {
    await rememberFile(path);
    log(`已选定：${path}`, 'ok');
  }
});

document.querySelector('#btn-append').addEventListener('click', async () => {
  if (!noteFile) {
    log('先选择笔记文件', 'error');
    return;
  }
  if (!noteElement.value.trim()) {
    log('待写入内容为空', 'error');
    return;
  }
  // 先读后写：保留已有内容，把新内容追加在末尾（文件不存在时 readText 会报错，忽略即可）。
  const existing = (await attempt(() => ztools.fs.readText(noteFile), 'fs.readText')) ?? '';
  const stamp = new Date().toLocaleString();
  const merged = `${typeof existing === 'string' ? existing : ''}${existing ? '\n\n' : ''}## ${stamp}\n${noteElement.value}\n`;
  const written = await attempt(() => ztools.fs.writeText(noteFile, merged), 'fs.writeText');
  if (written !== null) {
    previewElement.textContent = merged;
    await attempt(
      () => ztools.ui.showNotification({ title: '速记本', body: `已追加 ${noteElement.value.length} 个字符` }),
      'ui.showNotification'
    );
  }
  refresh();
});

document.querySelector('#btn-read').addEventListener('click', async () => {
  if (!noteFile) {
    log('先选择笔记文件', 'error');
    return;
  }
  const text = await attempt(() => ztools.fs.readText(noteFile), 'fs.readText');
  if (typeof text === 'string') {
    previewElement.textContent = text;
    refresh();
  }
});

document.querySelector('#btn-forget').addEventListener('click', async () => {
  await rememberFile(null);
  previewElement.textContent = '（还没有内容）';
  log('已清除所选文件（授权范围仍保留在宿主侧）', 'ok');
  refresh();
});

noteElement.addEventListener('input', refresh);

bootstrap({
  /**
   * 进入插件：按 feature 决定默认动作，并把载荷文本填进输入框。
   * @param {{code?: string, payload?: unknown}} event 生命周期事件。
   * @returns {Promise<void>} 完成后结束。
   */
  async onEnter(event) {
    const code = event.code ?? 'note.append';
    enterSummary.textContent = `由 ${code} 进入`;
    if (typeof event.payload === 'string' && event.payload !== '') {
      noteElement.value = event.payload;
    } else if (code === 'note.clip') {
      const text = await attempt(() => ztools.clipboard.readText(), 'clipboard.readText');
      if (typeof text === 'string') {
        noteElement.value = text;
      }
    }
    // 恢复上次选择的文件，省得每次都要重新选。
    const remembered = await attempt(() => ztools.storage.get(FILE_KEY), 'storage.get');
    if (typeof remembered === 'string' && remembered) {
      noteFile = remembered;
      log(`已恢复上次的笔记文件：${remembered}`, 'ok');
    }
    refresh();
  },

  /**
   * 退出插件。
   * @returns {void}
   */
  onExit() {
    log('onExit：所选文件已记在私有存储，下次进入自动恢复');
  }
});

refresh();
log('速记本已就绪：选择文件时会请求文件读写授权（仅授权你选中的路径）', 'ok');
