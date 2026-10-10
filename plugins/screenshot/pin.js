/**
 * 截图插件的"钉在桌面"贴图页。
 *
 * 运行在插件自建窗口（`plugin-window-*`，`persistent: true`）里：入口页把选区（含标注）合成为
 * PNG 放进取插件私有存储（`pin.payload`），本页取出来后铺满窗口 —— 会话结束时宿主不会关这类
 * 窗口，因此贴图留在桌面上，直到用户关掉它（Esc / 右上角 ✕）或插件被禁用 / 卸载。
 *
 * 交互（全部按**物理像素**算，鼠标位移按 `devicePixelRatio` 折算）：
 * - 画面内按下拖动 → 移动贴图（至少留 40px 在屏幕内，避免拖丢）；
 * - 边缘 / 角 6px 内按下拖动 → **保持长宽比**缩放（锚点为对边 / 对角，画面不会被拉变形）；
 * - Esc 或右上角 ✕ → 关闭。
 *
 * 尺寸与位置都交给宿主命令 `plugin_window_set_bounds`（`ztools.window.setBounds`）：宿主会把
 * 无边框窗口的隐形边框与 DPI 折算偏差补掉，返回的客户区矩形就是画布实际占的矩形，本页据此
 * 做后续推算（因此连续拖动不会漂移）。
 */
import { ztools } from './vendor/ztools-sdk/index.js';

/** 边缘判定宽度（CSS 像素）：落在带内 = 缩放，落在里面 = 拖动。 */
const EDGE = 6;
/** 缩放后的最小边长（物理像素，避免拖成一条线）。 */
const MIN_SIDE = 32;
/** 拖动时至少留在虚拟屏幕内的部分（物理像素）。 */
const KEEP_VISIBLE = 40;
/**
 * 验收模式：`pin` = 自动走一遍缩放 / 移动 / 关闭；`pin-hold` = 只建贴图不动，留给探针用
 * **真实鼠标**驱动（量拖动跟手程度）。生产地址不带该参数。
 */
const AUTOTEST_MODE = new URLSearchParams(window.location.search).get('autotest');
const AUTOTEST = AUTOTEST_MODE === 'pin';
const AUTOTEST_DIAG = AUTOTEST || AUTOTEST_MODE === 'pin-hold';

const stage = document.getElementById('pin-stage');
const ctx = stage.getContext('2d');
const closeButton = document.getElementById('pin-close');
const message = document.getElementById('pin-message');

const params = new URLSearchParams(window.location.search);
/** 虚拟屏幕边界（物理像素），拖动时夹取用。 */
const screenRect = {
  x: Number(params.get('sx')) || 0,
  y: Number(params.get('sy')) || 0,
  width: Number(params.get('sw')) || 0,
  height: Number(params.get('sh')) || 0,
};

/** 运行时状态。 */
const state = {
  /** 本窗口 label（宿主在首次 `setBounds` 时返回）。 */
  label: null,
  /** 当前客户区（物理像素，宿主返回的实际值）。 */
  rect: null,
  /** 合成好的贴图（`{ dataUrl, width, height }`；复制 / 保存 / 编辑都用它）。 */
  payload: null,
  /** 右键菜单正开着（菜单是模态的，避免重复弹）。 */
  menuOpen: false,
  /** 贴图原始尺寸（物理像素）。 */
  image: null,
  /** 正在进行的拖动。 */
  drag: null,
};

/** 待应用的客户区 + 串行泵（拖动时合并到一次 IPC 一次）。 */
let pendingRect = null;
let pumping = false;

/** 验收统计：`setBounds` 往返耗时与"收到多少次指针移动"（诊断拖动跟手程度）。 */
const stats = { moves: 0, applies: 0, totalMs: 0, maxMs: 0 };

/**
 * 把数值夹到区间内。
 * @param {number} value 原值。
 * @param {number} min 下限。
 * @param {number} max 上限。
 * @returns {number} 夹取后的值。
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 把 PNG 画进画布。
 * @param {string} dataUrl `data:image/png;base64,...`。
 * @returns {Promise<{width: number, height: number}>} 图片原始像素尺寸。
 */
function drawImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // 画布后备存储用图片原始像素，CSS 交给样式铺满窗口 → 窗口多大连画面就多大。
      stage.width = image.naturalWidth;
      stage.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);
      state.image = { width: image.naturalWidth, height: image.naturalHeight };
      if (AUTOTEST_DIAG) {
        // 验收辅助：把画布像素的 alpha 范围与几个采样点写进插件存储（探针直接读存储文件），
        // 用来区分"页面像素本身半透明"与"窗口合成变暗"。
        const data = ctx.getImageData(0, 0, stage.width, stage.height).data;
        let min = 255;
        let max = 0;
        for (let index = 3; index < data.length; index += 4) {
          if (data[index] < min) min = data[index];
          if (data[index] > max) max = data[index];
        }
        const middle = ((Math.floor(stage.height / 2) * stage.width) + Math.floor(stage.width / 2)) * 4;
        let magenta = 0;
        let cyan = 0;
        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          if (red > 180 && blue > 180 && green < 100) magenta += 1;
          if (green > 180 && blue > 180 && red < 100) cyan += 1;
        }
        void ztools.storage.set('pin.diag', {
          alphaMin: min,
          alphaMax: max,
          centerPixel: Array.from(data.slice(middle, middle + 4)),
          size: [stage.width, stage.height],
          magenta,
          cyan,
        });
      }
      resolve(state.image);
    };
    image.onerror = () => reject(new Error('贴图解码失败'));
    image.src = dataUrl;
  });
}

/**
 * 请宿主把窗口摆到指定客户区，并更新本地记录。
 * @param {{x: number, y: number, width: number, height: number}} rect 目标客户区（物理像素）。
 * @returns {Promise<object>} 应用后的实际客户区。
 */
async function applyRect(rect) {
  const startedAt = performance.now();
  const applied = await ztools.window.setBounds({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });
  state.rect = {
    x: applied.x,
    y: applied.y,
    width: applied.width,
    height: applied.height,
  };
  if (applied.label) {
    state.label = applied.label;
  }
  const elapsed = performance.now() - startedAt;
  stats.applies += 1;
  stats.totalMs += elapsed;
  if (elapsed > stats.maxMs) {
    stats.maxMs = elapsed;
  }
  return state.rect;
}

/**
 * 问宿主"我现在实际占的客户区是哪个矩形"（顺带取回自己的窗口 label）。
 *
 * 宿主 `setBounds({})` 会把当前客户区原样再摆一遍并返回实际值，因此这条也是"对齐一次"：
 * 窗口的初始几何由建窗时的同一条摆位逻辑给到，这里拿到的是权威值。
 *
 * @returns {Promise<object>} 实际客户区。
 */
async function refreshRect() {
  const applied = await ztools.window.setBounds({});
  state.rect = {
    x: applied.x,
    y: applied.y,
    width: applied.width,
    height: applied.height,
  };
  if (applied.label) {
    state.label = applied.label;
  }
  return state.rect;
}

/**
 * 排队应用一次客户区变更（拖动过程中合并：上一个 IPC 还没回来时只保留最后一次目标）。
 * @param {{x: number, y: number, width: number, height: number}} rect 目标客户区。
 * @returns {void}
 */
function queueApply(rect) {
  pendingRect = rect;
  void pump();
}

/**
 * 串行把排队的客户区变更下发（避免同一时刻并发多个 setBounds 互相覆盖）。
 * @returns {Promise<void>} 队列清空后结束的 Promise。
 */
async function pump() {
  if (pumping) {
    return;
  }
  pumping = true;
  while (pendingRect) {
    const rect = pendingRect;
    pendingRect = null;
    try {
      await applyRect(rect);
    } catch (error) {
      console.error('[screenshot] 贴图尺寸同步失败', error);
    }
  }
  pumping = false;
}

/**
 * 判定按下位置属于哪个区域。
 * @param {number} clientX 客户区 X（CSS 像素）。
 * @param {number} clientY 客户区 Y（CSS 像素）。
 * @returns {'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'} 区域名。
 */
function zoneAt(clientX, clientY) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const left = clientX <= EDGE;
  const right = clientX >= width - EDGE;
  const top = clientY <= EDGE;
  const bottom = clientY >= height - EDGE;
  if (top && left) return 'nw';
  if (top && right) return 'ne';
  if (bottom && left) return 'sw';
  if (bottom && right) return 'se';
  if (top) return 'n';
  if (bottom) return 's';
  if (left) return 'w';
  if (right) return 'e';
  return 'move';
}

/**
 * 拖动时至少留 `KEEP_VISIBLE` 在虚拟屏幕内（屏幕信息缺失时原样返回）。
 * @param {{x: number, y: number, width: number, height: number}} rect 目标客户区（物理像素）。
 * @returns {{x: number, y: number, width: number, height: number}} 夹取后的客户区。
 */
function keepOnScreen(rect) {
  if (!screenRect.width || !screenRect.height) {
    return rect;
  }
  const minX = screenRect.x - rect.width + KEEP_VISIBLE;
  const maxX = screenRect.x + screenRect.width - KEEP_VISIBLE;
  const minY = screenRect.y - rect.height + KEEP_VISIBLE;
  const maxY = screenRect.y + screenRect.height - KEEP_VISIBLE;
  return {
    ...rect,
    x: clamp(rect.x, minX, maxX),
    y: clamp(rect.y, minY, maxY),
  };
}

/**
 * 按拖动区域与位移算出新的客户区（缩放**保持长宽比**，锚点在对边 / 对角）。
 * @param {'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'} zone 区域名。
 * @param {number} dx 水平位移（物理像素，向右为正）。
 * @param {number} dy 垂直位移（物理像素，向下为正）。
 * @returns {{x: number, y: number, width: number, height: number}} 目标客户区。
 */
function resizeRect(zone, dx, dy) {
  const start = state.drag.startRect;
  const aspect = start.width / start.height;
  const maxWidth = Math.max(MIN_SIDE, screenRect.width || start.width * 8);
  const maxHeight = Math.max(MIN_SIDE, screenRect.height || start.height * 8);
  const horizontal = zone.includes('e') || zone.includes('w');
  const vertical = zone.includes('n') || zone.includes('s');
  let width = start.width;
  let height = start.height;
  if (horizontal && !vertical) {
    width = clamp(start.width + (zone.includes('e') ? dx : -dx), MIN_SIDE, maxWidth);
    height = width / aspect;
  } else if (vertical && !horizontal) {
    height = clamp(start.height + (zone.includes('s') ? dy : -dy), MIN_SIDE, maxHeight);
    width = height * aspect;
  } else {
    // 角：取位移较大的那根轴做驱动，另一根按比例跟随。
    const scaleX = (start.width + (zone.includes('e') ? dx : -dx)) / start.width;
    const scaleY = (start.height + (zone.includes('s') ? dy : -dy)) / start.height;
    const scale = Math.abs(dx) >= Math.abs(dy) ? scaleX : scaleY;
    width = clamp(start.width * scale, MIN_SIDE, maxWidth);
    height = width / aspect;
  }
  // 锚点：被拖的边跟着鼠标走，对边不动。
  const x = zone.includes('w') ? start.x + start.width - width : start.x;
  const y = zone.includes('n') ? start.y + start.height - height : start.y;
  return { x, y, width, height };
}

/**
 * 鼠标移动：没在拖动时更新光标形状。
 * @param {PointerEvent} event 指针事件。
 * @returns {void}
 */
function updateCursor(event) {
  const zone = zoneAt(event.clientX, event.clientY);
  stage.dataset.zone = zone;
}

/**
 * 指针按下：决定这次拖动是"移动"还是"缩放"。
 * @param {PointerEvent} event 指针事件。
 * @returns {void}
 */
function onPointerDown(event) {
  if (event.button !== 0 || !state.rect) {
    return;
  }
  const zone = zoneAt(event.clientX, event.clientY);
  state.drag = {
    zone,
    // 记录**屏幕**坐标作为位移基准（见 `onPointerMove`：客户区坐标会与"窗口跟着走"互相追赶）。
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startRect: { ...state.rect },
  };
  try {
    // 真实指针：捕获后即使拖到窗口外也能继续收到事件（窗口变小时尤其重要）。
    // 验收探针合成的指针事件没有活动指针，捕获会抛错 —— 忽略即可。
    stage.setPointerCapture(event.pointerId);
  } catch {
    /* 合成事件：无需捕获 */
  }
  event.preventDefault();
}

/**
 * 指针移动：按区域把窗口移动 / 缩放（物理像素位移 = CSS 位移 × devicePixelRatio）。
 * @param {PointerEvent} event 指针事件。
 * @returns {void}
 */
function onPointerMove(event) {
  stats.moves += 1;
  if (!state.drag) {
    updateCursor(event);
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  // 位移必须用**屏幕坐标**：窗口本身跟着光标走，`clientX/clientY` 是相对客户区的，会形成
  // "光标追窗口、窗口追光标"的互相追赶 —— 实测光标走 144px、窗口只跟 54px，滞后越拖越大
  // （用户说的"阻力大、延迟高"）。`screenX/screenY` 不随窗口移动而变，才能真正贴着光标走。
  const dx = (event.screenX - state.drag.startScreenX) * dpr;
  const dy = (event.screenY - state.drag.startScreenY) * dpr;
  const start = state.drag.startRect;
  const next =
    state.drag.zone === 'move'
      ? keepOnScreen({ x: start.x + dx, y: start.y + dy, width: start.width, height: start.height })
      : resizeRect(state.drag.zone, dx, dy);
  queueApply(next);
  event.preventDefault();
}

/**
 * 指针抬起：结束这次拖动。
 * @param {PointerEvent} event 指针事件。
 * @returns {void}
 */
function onPointerUp(event) {
  if (!state.drag) {
    return;
  }
  state.drag = null;
  try {
    stage.releasePointerCapture(event.pointerId);
  } catch {
    /* 没有捕获过（合成事件） */
  }
  updateCursor(event);
  publishDragStats();
}

/**
 * 验收辅助：把拖动统计写进插件存储（探针直接读存储文件）。
 *
 * 用途：量"每帧一次 `setBounds` IPC"的真实开销与合并情况（`moves` 收到多少次指针移动、
 * `applies` 真正下发几次窗口变更、平均 / 最大往返毫秒）。
 *
 * @returns {void}
 */
function publishDragStats() {
  if (!AUTOTEST_DIAG) {
    return;
  }
  // 留一点时间让串行泵把队列排空（最后几帧的 apply 可能还在路上）。
  window.setTimeout(() => {
    void ztools.storage.set('pin.drag', {
      moves: stats.moves,
      applies: stats.applies,
      avgMs: stats.applies ? Math.round((stats.totalMs / stats.applies) * 100) / 100 : 0,
      maxMs: Math.round(stats.maxMs * 100) / 100,
    });
  }, 400);
}

/**
 * 在贴图上闪一条状态文字（复制 / 保存的反馈）。
 *
 * 为什么不用 `ztools.ui.notify`：那需要 `notification.show` 权限；这里是贴图自己的反馈，
 * 用页内提示更直接，也不给插件加权限。
 *
 * @param {string} text 文本。
 * @param {number} [ms] 显示时长（毫秒）。
 * @returns {void}
 */
function flash(text, ms = 1200) {
  if (!message) {
    return;
  }
  message.textContent = text;
  message.hidden = false;
  window.setTimeout(() => {
    message.hidden = true;
  }, ms);
}

/**
 * 复制贴图到系统剪贴板（用的就是本页显示的那张合成图）。
 * @returns {Promise<void>} 复制结束后结束的 Promise。
 */
async function copyPin() {
  if (!state.payload?.dataUrl) {
    return;
  }
  try {
    await ztools.clipboard.writeImage(state.payload.dataUrl);
    flash('已复制到剪贴板');
  } catch (error) {
    flash('复制失败（详见控制台）');
    console.error('[screenshot] 贴图复制失败', error);
  }
}

/**
 * 保存贴图到截图目录（`<data_root>/screenshots/`）。
 * @returns {Promise<void>} 保存结束后结束的 Promise。
 */
async function savePin() {
  if (!state.payload?.dataUrl) {
    return;
  }
  try {
    const saved = await ztools.screen.save(state.payload.dataUrl);
    const name = String(saved?.path ?? '').split(/[\\/]/).pop() || '';
    flash(name ? `已保存 ${name}` : '已保存', 2000);
    console.log('[screenshot] 贴图已保存到', saved?.path ?? '(未知路径)');
  } catch (error) {
    flash('保存失败（详见控制台）');
    console.error('[screenshot] 贴图保存失败', error);
  }
}

/**
 * 编辑贴图：把图和它当前的屏幕矩形交给截图编辑器（`overlay.html` 的 `pin-edit` 模式）。
 *
 * 编辑器里点「钉住」会把编辑结果放回原位（并负责关掉本贴图）；点复制 / 保存 / Esc 都不动本贴图。
 *
 * @returns {Promise<void>} 编辑器窗口打开后结束的 Promise。
 */
async function editPin() {
  if (!state.payload?.dataUrl || !state.rect) {
    return;
  }
  try {
    await ztools.storage.set('edit.payload', state.payload);
    const rect = state.rect;
    // 编辑器只承载贴图；为工具栏留出空间，背景透明，不采集或合成桌面画面。
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(rect.width, Math.round(620 * dpr));
    const height = rect.height + Math.round(76 * dpr);
    const x = Math.max(screenRect.x, Math.min(rect.x - (width - rect.width) / 2, screenRect.x + screenRect.width - width));
    const y = Math.max(screenRect.y, Math.min(rect.y, screenRect.y + screenRect.height - height));
    await ztools.window.open('overlay.html', {
      title: 'ZTools 截图（插件）',
      x: Math.round(x),
      y: Math.round(y),
      width,
      height,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focus: true,
      visible: false,
      query: new URLSearchParams({
        source: 'pin-edit',
        // 当前显示尺寸与原图分辨率独立保存，编辑后不改变已有缩放。
        rect: `${rect.x},${rect.y},${rect.width},${rect.height}`,
        screen: `${screenRect.x},${screenRect.y},${screenRect.width},${screenRect.height}`,
        oldPin: state.label ?? '',
        ...(AUTOTEST_DIAG ? { autotest: AUTOTEST_MODE } : {}),
      }).toString(),
    });
  } catch (error) {
    flash('打开编辑器失败（详见控制台）');
    console.error('[screenshot] 打开贴图编辑器失败', error);
  }
}

/**
 * 右键菜单：关闭 / 复制 / 保存 / 编辑。
 *
 * 菜单由宿主弹**原生**菜单（`ztools.ui.contextMenu`）：贴图窗口可能很小，页内菜单会被窗口裁掉。
 *
 * @param {MouseEvent} event 右键事件。
 * @returns {Promise<void>} 菜单处理完后结束的 Promise。
 */
async function onContextMenu(event) {
  event.preventDefault();
  if (state.menuOpen) {
    return;
  }
  state.menuOpen = true;
  try {
    const choice = await ztools.ui.contextMenu([
      { id: 'close', label: '关闭' },
      { id: 'copy', label: '复制' },
      { id: 'save', label: '保存' },
      { id: 'edit', label: '编辑' },
    ]);
    if (choice === 'close') {
      await closePin();
    } else if (choice === 'copy') {
      await copyPin();
    } else if (choice === 'save') {
      await savePin();
    } else if (choice === 'edit') {
      await editPin();
    }
  } catch (error) {
    flash('右键菜单不可用（详见控制台）');
    console.error('[screenshot] 贴图右键菜单失败', error);
  } finally {
    state.menuOpen = false;
  }
}

/** 关闭贴图（Esc / ✕）。 */
async function closePin() {
  try {
    if (!state.label) {
      await refreshRect();
    }
    if (state.label) {
      await ztools.window.close(state.label);
      return;
    }
  } catch (error) {
    console.error('[screenshot] 关闭贴图失败', error);
  }
  // 兜底：至少把画面收起来，别留个死窗口。
  document.body.style.display = 'none';
}

/**
 * 键盘：Esc 关闭。
 * @param {KeyboardEvent} event 键盘事件。
 * @returns {void}
 */
function onKeyDown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    void closePin();
  }
}

/** 绑定交互。 */
function bindEvents() {
  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  // 右键 = 原生菜单（关闭 / 复制 / 保存 / 编辑）
  window.addEventListener('contextmenu', (event) => void onContextMenu(event));
  window.addEventListener('pointerenter', () => {
    if (closeButton) {
      closeButton.hidden = false;
    }
  });
  window.addEventListener('pointerleave', () => {
    if (closeButton && !state.drag) {
      closeButton.hidden = true;
    }
  });
  closeButton?.addEventListener('click', () => void closePin());
}

/**
 * 验收辅助：合成一次真实指针序列（探针用来覆盖"拖动 → 缩放 / 移动"这条链路）。
 *
 * 坐标必须用 `clientX` / `clientY`（区域判定）**和** `screenX` / `screenY`（位移基准，
 * `PointerEvent` 不认 `x` / `y`）。屏幕坐标由"客户区坐标 + 窗口在屏幕上的原点"折算，
 * 与真实事件一致。
 *
 * @param {{x: number, y: number}} from 起点（客户区坐标，CSS 像素）。
 * @param {{x: number, y: number}} to 终点（客户区坐标，CSS 像素）。
 * @returns {void}
 */
function synthesizeDrag(from, to) {
  const dpr = window.devicePixelRatio || 1;
  const originX = state.rect ? state.rect.x / dpr : 0;
  const originY = state.rect ? state.rect.y / dpr : 0;
  const options = { bubbles: true, button: 0, pointerId: 1, pointerType: 'mouse' };
  stage.dispatchEvent(
    new PointerEvent('pointerdown', {
      ...options,
      clientX: from.x,
      clientY: from.y,
      screenX: originX + from.x,
      screenY: originY + from.y,
    }),
  );
  window.dispatchEvent(
    new PointerEvent('pointermove', {
      ...options,
      clientX: to.x,
      clientY: to.y,
      screenX: originX + to.x,
      screenY: originY + to.y,
    }),
  );
  window.dispatchEvent(
    new PointerEvent('pointerup', {
      ...options,
      clientX: to.x,
      clientY: to.y,
      screenX: originX + to.x,
      screenY: originY + to.y,
    }),
  );
}

/**
 * 验收辅助：等一会儿（让探针有时间采样窗口矩形 / 截图）。
 * @param {number} ms 毫秒。
 * @returns {Promise<void>} 到点后结束的 Promise。
 */
function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * 验收辅助：从右边缘往里拖到 3/4 宽（缩放），再在画面中间拖动（移动），最后关掉自己。
 *
 * 每一步之间留 1.2s：验收探针按 ~100ms 采样窗口矩形与屏幕像素，据此断言"真的缩放 / 移动了"。
 *
 * @returns {Promise<void>} 三步走完后结束的 Promise。
 */
async function runAutotest() {
  await sleep(1500);
  const width = window.innerWidth;
  const height = window.innerHeight;
  // 1) 右边缘往里拖 → 宽度变成 3/4（长宽比保持）
  synthesizeDrag(
    { x: width - 2, y: Math.round(height / 2) },
    { x: width - 2 - Math.round(width / 4), y: Math.round(height / 2) },
  );
  await sleep(1200);
  // 2) 画面中间拖动 → 窗口右移 60 CSS 像素（= 60 × dpr 物理像素）
  synthesizeDrag(
    { x: Math.round(width / 2), y: Math.round(height / 2) },
    { x: Math.round(width / 2) + 60, y: Math.round(height / 2) },
  );
  await sleep(1200);
  // 3) 关掉自己
  await closePin();
}

/** 页面启动：取画面 → 画布 → 对齐几何 → 露脸 → 绑定交互。 */
async function boot() {
  try {
    const payload = await ztools.storage.get('pin.payload');
    await ztools.storage.remove('pin.payload');
    if (!payload?.dataUrl) {
      throw new Error('没有可用的贴图内容');
    }
    state.payload = payload;
    await drawImage(payload.dataUrl);
    // 让宿主按"客户区"把窗口精确摆一遍，并取回自己的 label 与实际矩形（后续缩放据此推算）。
    await refreshRect();
    bindEvents();
    await ztools.window.show();
    if (AUTOTEST) {
      void runAutotest();
    }
  } catch (error) {
    // 出错也要露脸（宿主 5s 后也有兜底显示），至少让用户看到"贴图没上来"并能关掉。
    if (message) {
      message.hidden = false;
      message.textContent = `贴图加载失败：${error?.message ?? error}（Esc 关闭）`;
    }
    bindEvents();
    console.error('[screenshot] 贴图启动失败', error);
  }
}

void boot();
