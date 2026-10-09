/**
 * 剪贴板（外部插件 `com.ztools.clipboard`）。
 *
 * 架构（`07 §5` / `07 §9`）：**原生能力留在宿主**（剪贴板监视、历史落盘/去重/裁剪、
 * 粘贴注入、`CF_DIB → PNG`），插件只经 `@ztools/sdk` 调用：
 * - `ztools.clipboard.history()` / `historyImage()`：读历史（需 `clipboard.read`）；
 * - `ztools.clipboard.pasteHistory()` / `clearHistory()` / `removeHistory()`：写（需 `clipboard.write`）；
 * - `ztools.clipboard.status()`：监视与历史状态。
 *
 * 两个与"宿主独立窗口"时代不同的交互（因为本插件跑在标准插件窗口里）：
 * 1. 插件视图是 `focusable(false)` 的（主面板里）→ 搜索框用宿主输入框
 *    （`ztools.ui.setSubInput` + `onSubInputChange`，即 T7-1 的"子输入框"），插件页自己不放输入框；
 *    分离到独立窗口后，宿主会在**自定义顶栏中间**给出同一个搜索框（同一套子输入框协议），
 *    因此这里不需要区分两种形态。
 * 2. 插件窗口不能订阅 Tauri 事件（T7-8 白名单）→ 进入/搜索时刷新 + 1.5s 轮询。
 */
import { bootstrap, ztools, ZToolsApiError } from './vendor/ztools-sdk/index.js';

/** 列表容器。 */
const listElement = document.querySelector('#list');
/** 条数显示。 */
const countElement = document.querySelector('#count');
/** 顶部提示（错误与动作回执）。 */
const noticeElement = document.querySelector('#notice');
/** 清空按钮。 */
const clearButton = document.querySelector('#btn-clear');
/** 分类页签（全部 / 文本 / 图片）。 */
const tabButtons = Array.from(document.querySelectorAll('.tab'));

/** 当前列表（宿主返回的原始条目）。 */
let items = [];
/** 当前搜索词（来自主面板子输入框）。 */
let query = '';
/** 当前分类（`all` | `text` | `image`）。 */
let kindFilter = 'all';
/** 当前悬停/选中的下标。 */
let selectedIndex = 0;
/** 最近一次状态（条数、是否监听中）。 */
let status = null;
/** 轮询定时器。 */
let pollTimer = null;
/** 已取到的图片缩略图（id → data URL 或 null）。 */
const previews = new Map();

/**
 * 写一行提示。
 * @param text 文本。
 * @returns 无返回值。
 */
function showNotice(text) {
  noticeElement.textContent = text ?? '';
}

/**
 * 把异常归一化后显示（`ZToolsApiError` 带 `kind` / `detail`）。
 * @param error 原始异常。
 * @returns 无返回值。
 */
function fail(error) {
  const apiError = ZToolsApiError.from(error);
  showNotice(`${apiError.kind}：${apiError.detail}`);
}

/**
 * 时间戳 → `HH:MM`。
 * @param timestampMs Unix 毫秒。
 * @returns 展示用时间。
 */
function formatTime(timestampMs) {
  if (!timestampMs) return '';
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 字节数 → 可读大小。
 * @param bytes 字节数。
 * @returns 展示用大小。
 */
function formatSize(bytes) {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 按当前分类过滤后的可见条目。
 * @returns 可见条目数组（`all` 时直接返回原列表）。
 */
function visibleItems() {
  if (kindFilter === 'image') return items.filter((item) => item.kind === 'image');
  if (kindFilter === 'text') return items.filter((item) => item.kind !== 'image');
  return items;
}

/**
 * 渲染底栏右侧的条数与监视状态。
 * @returns 无返回值。
 */
function renderCount() {
  const total = status?.items ?? items.length;
  const state = status ? (status.enabled ? '监听中' : '已关闭') : '';
  const shown = visibleItems().length;
  countElement.textContent = `${shown} / ${total} 条${state ? ` · ${state}` : ''}`;
}

/**
 * 选中一行（只改 class，不重排列表）。
 * @param index 目标下标。
 * @returns 无返回值。
 */
function selectRow(index) {
  selectedIndex = index;
  const rows = listElement.querySelectorAll('.item');
  rows.forEach((row, current) => {
    row.classList.toggle('is-selected', current === index);
  });
}

/**
 * 渲染列表（纯 DOM 构建，不拼接 HTML）。
 * @returns 无返回值。
 */
function renderList() {
  const visible = visibleItems();
  listElement.textContent = '';
  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    if (items.length > 0) empty.textContent = '该分类暂无记录';
    else empty.textContent = query.trim() ? '没有匹配的历史' : '暂无剪贴板记录';
    listElement.appendChild(empty);
    return;
  }
  visible.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = index === selectedIndex ? 'item is-selected' : 'item';
    row.title = item.preview ?? '';
    row.addEventListener('mouseenter', () => selectRow(index));
    row.addEventListener('click', () => void pasteItem(item));

    const preview = document.createElement('div');
    preview.className = 'item-preview';
    const thumbnail = previews.get(item.id);
    if (item.kind === 'image' && typeof thumbnail === 'string') {
      const image = document.createElement('img');
      image.className = 'item-image';
      image.src = thumbnail;
      image.alt = '剪贴板图片预览';
      preview.appendChild(image);
    } else if (item.kind === 'image') {
      const placeholder = document.createElement('span');
      placeholder.className = 'item-placeholder';
      placeholder.textContent = '图片';
      preview.appendChild(placeholder);
    } else {
      preview.className = 'item-preview is-text';
      preview.textContent = item.text ?? item.preview ?? '';
    }
    row.appendChild(preview);

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.kind === 'image' ? '图片' : '文本';
    meta.appendChild(badge);
    for (const text of [formatTime(item.timestampMs), item.resolution, formatSize(item.sizeBytes)]) {
      if (!text) continue;
      const span = document.createElement('span');
      span.textContent = text;
      meta.appendChild(span);
    }
    row.appendChild(meta);
    listElement.appendChild(row);
  });
}

/**
 * 切换分类页签（全部 / 文本 / 图片）：只影响列表展示，不动宿主返回的 `items`。
 * @param kind 目标分类（`all` | `text` | `image`）。
 * @returns 无返回值。
 */
function applyKindFilter(kind) {
  if (kind !== 'all' && kind !== 'text' && kind !== 'image') return;
  kindFilter = kind;
  selectedIndex = 0;
  tabButtons.forEach((button) => {
    const active = button.dataset.kind === kind;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderList();
  renderCount();
}

/**
 * 给列表里的图片条目补缩略图（每次刷新最多取 20 张，避免刷屏式 IPC）。
 * @returns 无返回值的 Promise。
 */
async function loadPreviews() {
  const pending = items
    .filter((item) => item.kind === 'image' && !previews.has(item.id))
    .slice(0, 20);
  if (pending.length === 0) return;
  for (const item of pending) {
    try {
      previews.set(item.id, await ztools.clipboard.historyImage(item.id));
    } catch {
      // 单条图片转换失败（位深 / 文件缺失）不应该影响整个列表。
      previews.set(item.id, null);
    }
  }
  renderList();
}

/**
 * 读取一次历史（带当前搜索词）。
 * @returns 无返回值的 Promise。
 */
async function refresh() {
  try {
    items = await ztools.clipboard.history({
      query: query.trim() ? query.trim() : undefined,
      limit: 200,
    });
    const visible = visibleItems();
    if (selectedIndex >= visible.length) {
      selectedIndex = Math.max(0, visible.length - 1);
    }
    renderList();
    renderCount();
    void loadPreviews();
  } catch (error) {
    fail(error);
  }
}

/**
 * 读取一次监视状态。
 * @returns 无返回值的 Promise。
 */
async function refreshStatus() {
  try {
    status = await ztools.clipboard.status();
  } catch {
    status = null;
  }
  renderCount();
}

/**
 * 粘贴一条历史：宿主写回剪贴板并按设置决定是否注入 `Ctrl+V`，随后收起面板。
 * @param item 条目。
 * @returns 无返回值的 Promise。
 */
async function pasteItem(item) {
  try {
    await ztools.clipboard.pasteHistory(item.id);
    showNotice('已粘贴');
  } catch (error) {
    fail(error);
  }
}

/**
 * 清空历史（先让用户确认，避免误点）。
 * @returns 无返回值的 Promise。
 */
async function clearAll() {
  if (items.length === 0) {
    showNotice('没有可清空的历史');
    return;
  }
  if (!window.confirm(`确定清空全部 ${items.length} 条历史（含图片文件）吗？`)) {
    return;
  }
  try {
    const removed = await ztools.clipboard.clearHistory();
    showNotice(`已清空 ${removed} 条`);
    previews.clear();
    await refresh();
  } catch (error) {
    fail(error);
  }
}

clearButton.addEventListener('click', () => void clearAll());

tabButtons.forEach((button) => {
  button.addEventListener('click', () => applyKindFilter(button.dataset.kind));
});

/*
 * 子输入框（T7-1）：搜索放在宿主输入框里——主面板里是主面板搜索框，
 * 分离窗口里是自定义顶栏中间的搜索框；两者都是同一套 `sub-input` 协议。
 * 订阅要在模块顶层注册（宿主推的是命名事件，不排队）。
 */
ztools.ui.onSubInputChange((value) => {
  query = typeof value === 'string' ? value : '';
  void refresh();
});

bootstrap({
  async onEnter() {
    showNotice('');
    // 宿主输入框就是本插件的搜索框（主面板搜索框 / 分离窗口顶栏搜索框）。
    try {
      await ztools.ui.setSubInput({ placeholder: '搜索剪贴板…', isFocus: true });
    } catch (error) {
      fail(error);
    }
    await refreshStatus();
    await refresh();
    // 插件窗口不能订阅宿主事件（T7-8）→ 轮询保持列表新鲜（粘贴/复制后仍能看到新条目）。
    if (pollTimer === null) {
      pollTimer = window.setInterval(() => {
        void refreshStatus();
        void refresh();
      }, 1500);
    }
  },
  onExit() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    showNotice('');
  },
});
