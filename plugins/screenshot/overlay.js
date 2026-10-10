/**
 * 截图插件的全屏选区 / 标注页。
 *
 * 运行在插件自建窗口（`plugin-window-*`）里：入口页已把窗口按虚拟屏幕的**物理像素**摆好，
 * 本页把宿主捕获的整屏图铺满窗口，然后提供：
 * - 拖选区域（初始工具）、移动/重选；
 * - 标注工具：矩形 / 椭圆 / 箭头 / 画笔 / 文本 / 马赛克；
 * - 撤销、颜色与线宽；
 * - 复制到剪贴板（`ztools.clipboard.writeImage`）/ 保存到截图目录（`ztools.screen.save`）。
 *
 * 所有坐标都按**图像（物理）像素**存储，绘制与导出都在这套坐标系里做；鼠标事件按
 * `画布 CSS 宽度 → 图像宽度` 的比例换算，因此窗口 DPI/缩放下都能对齐。
 *
 * 窗口是入口页用 `visible: false` **隐藏建窗**的：本页把冻结帧画进画布之后才调
 * [`revealWindow`]（`ztools.window.show()`）露脸，避免先露出一个空白全屏窗口（"屏幕闪一下"）。
 */
import { ztools } from './vendor/ztools-sdk/index.js';

/** 默认线宽（图像像素）。 */
const DEFAULT_STROKE = 3;
/** 选区最小边长（图像像素）：比它小视为“没选出东西”。 */
const MIN_SIZE = 4;
/** 马赛克块边长（图像像素）。 */
const MOSAIC_BLOCK = 10;
/** 文本标注字号（图像像素）。 */
const TEXT_FONT = 30;

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const toolbar = document.getElementById('toolbar');
const hint = document.getElementById('hint');
const textInput = document.getElementById('text-input');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');

/** 运行时状态。 */
const state = {
  /** 宿主返回的捕获（几何 + dataUrl）。 */
  capture: null,
  /** 已解码的截图位图。 */
  image: null,
  /** 当前工具。 */
  tool: 'select',
  /** 选区（图像像素）：`{ x, y, w, h }`。 */
  selection: null,
  /** 鼠标悬停预选框（未确认，不用于导出）。 */
  hoverSelection: null,
  /** 单击确认时使用的窗口候选框。 */
  clickSelection: null,
  /** 已提交的标注。 */
  annotations: [],
  /** 正在拖拽的标注（未提交）。 */
  draft: null,
  /** 画笔正在收集的点。 */
  penPoints: null,
  /** 拖拽起点（图像像素）。 */
  dragOrigin: null,
  /** 文本标注的落点（图像像素）。 */
  textAnchor: null,
  /** 当前颜色。 */
  stroke: colorInput?.value || '#ff3b30',
  /** 当前线宽。 */
  strokeWidth: DEFAULT_STROKE,
  /** 文本字号（图像像素）。 */
  textFontSize: TEXT_FONT,
  /** 导出中标记（避免重复提交）。 */
  busy: false,
};

/**
 * 把鼠标事件坐标换算成图像（物理）像素。
 * @param {MouseEvent} event 鼠标事件。
 * @returns {{x: number, y: number}} 图像坐标。
 */
function toImagePoint(event) {
  const rect = stage.getBoundingClientRect();
  const scale = rect.width > 0 && state.capture ? state.capture.width / rect.width : 1;
  return {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
}

/**
 * 归一化两个点构成的矩形（支持任意拖拽方向）。
 * @param {{x: number, y: number}} a 起点。
 * @param {{x: number, y: number}} b 终点。
 * @returns {{x: number, y: number, w: number, h: number}} 左上角 + 宽高。
 */
function normalize(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/**
 * 把矩形裁进图像范围（导出时避免越界）。
 * @param {{x: number, y: number, w: number, h: number}} rect 原始矩形。
 * @returns {{x: number, y: number, w: number, h: number}} 裁好的矩形。
 */
function clampRect(rect) {
  const width = state.capture?.width ?? 0;
  const height = state.capture?.height ?? 0;
  const x = Math.max(0, Math.min(rect.x, width));
  const y = Math.max(0, Math.min(rect.y, height));
  return {
    x,
    y,
    w: Math.max(0, Math.min(rect.w, width - x)),
    h: Math.max(0, Math.min(rect.h, height - y)),
  };
}

/**
 * 把马赛克块打在当前画布的指定区域上（读同一画布已有内容再降采样放大）。
 * @param {CanvasRenderingContext2D} target 目标上下文。
 * @param {{x: number, y: number, w: number, h: number}} rect 区域（图像像素）。
 * @returns {void}
 */
function drawMosaic(target, rect) {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(w / MOSAIC_BLOCK));
  small.height = Math.max(1, Math.round(h / MOSAIC_BLOCK));
  const smallCtx = small.getContext('2d');
  smallCtx.drawImage(target.canvas, rect.x, rect.y, w, h, 0, 0, small.width, small.height);
  target.save();
  target.imageSmoothingEnabled = false;
  target.drawImage(small, 0, 0, small.width, small.height, rect.x, rect.y, w, h);
  target.restore();
}

/**
 * 画一条标注。
 * @param {CanvasRenderingContext2D} target 目标上下文（画布坐标 = 图像像素）。
 * @param {object} shape 标注对象。
 * @returns {void}
 */
function drawAnnotation(target, shape) {
  const color = shape.color || '#ff3b30';
  const width = shape.width || DEFAULT_STROKE;
  target.save();
  target.strokeStyle = color;
  target.fillStyle = color;
  target.lineWidth = width;
  target.lineCap = 'round';
  target.lineJoin = 'round';

  if (shape.type === 'rect') {
    target.strokeRect(shape.x, shape.y, shape.w, shape.h);
  } else if (shape.type === 'ellipse') {
    target.beginPath();
    target.ellipse(
      shape.x + shape.w / 2,
      shape.y + shape.h / 2,
      Math.max(1, shape.w / 2),
      Math.max(1, shape.h / 2),
      0,
      0,
      Math.PI * 2,
    );
    target.stroke();
  } else if (shape.type === 'arrow') {
    const head = Math.max(10, width * 4);
    const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    target.beginPath();
    target.moveTo(shape.x1, shape.y1);
    target.lineTo(shape.x2, shape.y2);
    target.stroke();
    target.beginPath();
    target.moveTo(shape.x2, shape.y2);
    target.lineTo(
      shape.x2 - head * Math.cos(angle - Math.PI / 7),
      shape.y2 - head * Math.sin(angle - Math.PI / 7),
    );
    target.lineTo(
      shape.x2 - head * Math.cos(angle + Math.PI / 7),
      shape.y2 - head * Math.sin(angle + Math.PI / 7),
    );
    target.closePath();
    target.fill();
  } else if (shape.type === 'pen') {
    const points = shape.points || [];
    target.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        target.moveTo(point.x, point.y);
      } else {
        target.lineTo(point.x, point.y);
      }
    });
    target.stroke();
  } else if (shape.type === 'text') {
    target.font = `600 ${shape.fontSize || TEXT_FONT}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    target.textBaseline = 'top';
    target.fillText(shape.text || '', shape.x, shape.y);
  } else if (shape.type === 'mosaic') {
    drawMosaic(target, shape);
  }
  target.restore();
}

/**
 * 选区外压暗 + 画选框。
 * @param {{x: number, y: number, w: number, h: number}} rect 选区。
 * @returns {void}
 */
function drawSelection(rect) {
  const { width, height } = state.capture;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#0a84ff';
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  ctx.restore();
}

/** 重绘整张画布。 */
function render() {
  if (!state.image || !state.capture) {
    return;
  }
  const { width, height } = state.capture;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(state.image, 0, 0, width, height);
  state.annotations.forEach((shape) => drawAnnotation(ctx, shape));
  if (state.draft) {
    drawAnnotation(ctx, state.draft);
  }
  if (state.selection || state.hoverSelection) {
    drawSelection(state.selection || state.hoverSelection);
  }
  positionToolbar();
}

/** 把工具条摆到选区下方（放不下就摆上方），没有选区时放在顶部居中。 */
function positionToolbar() {
  if (!toolbar || toolbar.hidden || !state.capture) {
    return;
  }
  const rect = stage.getBoundingClientRect();
  const scale = state.capture.width > 0 ? rect.width / state.capture.width : 1;
  const size = toolbar.getBoundingClientRect();
  if (state.pinDisplayRect) {
    toolbar.style.left = `${Math.max(0, (window.innerWidth - size.width) / 2)}px`;
    toolbar.style.top = `${rect.bottom + size.height + 10 <= window.innerHeight ? rect.bottom + 10 : Math.max(0, rect.top - size.height - 10)}px`;
    return;
  }
  let left = rect.width / 2 - size.width / 2;
  let top = 16;
  if (state.selection) {
    const sel = state.selection;
    left = sel.x * scale + (sel.w * scale) / 2 - size.width / 2;
    top = sel.y * scale + sel.h * scale + 10;
    if (top + size.height > rect.height) {
      top = Math.max(8, sel.y * scale - size.height - 10);
    }
  }
  toolbar.style.left = `${Math.max(8, Math.min(left, rect.width - size.width - 8))}px`;
  toolbar.style.top = `${Math.max(8, top)}px`;
}

/** 更新工具按钮的激活态。 */
function refreshToolButtons() {
  toolbar?.querySelectorAll('button[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === state.tool);
  });
  // 文本使用字号，其余工具使用线宽；两项分别保留上次设置。
  if (sizeInput) {
    const isText = state.tool === 'text';
    const label = isText ? '字号' : '线宽';
    sizeInput.min = isText ? '8' : '1';
    sizeInput.max = isText ? '120' : '12';
    sizeInput.value = String(isText ? state.textFontSize : state.strokeWidth);
    sizeInput.setAttribute('aria-label', label);
    sizeInput.parentElement.setAttribute('aria-label', label);
    sizeInput.parentElement.dataset.tooltip = label;
  }
}

/**
 * 按当前工具更新顶部提示。
 *
 * 文本工具的提交键与全局快捷键不一样（回车是"确认文字"而不是"复制整张图"），必须说清楚，
 * 否则用户按下回车会以为整张图被复制走了。
 *
 * @returns {void}
 */
function setToolHint() {
  if (!hint) {
    return;
  }
  hint.textContent =
    state.tool === 'text'
      ? '点击画面输入文字 · 回车确认 · Esc 取消输入'
      : '悬停预选窗口 · 单击确认（桌面空白处选全屏）· 拖动自由框选 · Enter 复制 · Esc 取消';
}

/**
 * 提交一个标注并重绘。
 * @param {object} shape 标注对象。
 * @returns {void}
 */
function commitAnnotation(shape) {
  state.annotations.push(shape);
  state.draft = null;
  state.penPoints = null;
  render();
}

/**
 * 把当前选区（含标注）合成为 PNG data URL。
 * @returns {string} `data:image/png;base64,...`。
 */
function compose() {
  const sel = clampRect(state.selection);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(sel.w));
  output.height = Math.max(1, Math.round(sel.h));
  const outCtx = output.getContext('2d');
  // 底图裁到选区，再把标注整体平移过来；马赛克因此能叠在已有内容上。
  outCtx.drawImage(state.image, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
  outCtx.save();
  outCtx.translate(-sel.x, -sel.y);
  state.annotations.forEach((shape) => drawAnnotation(outCtx, shape));
  outCtx.restore();
  return output.toDataURL('image/png');
}

/**
 * 收尾：先走会话退出，再兜底关掉本页所在的窗口。
 *
 * 正常截图流程里 `ztools.exit()` 会连本窗口一起关掉；但 `pin-edit`（编辑贴图）是在贴图钉好之后
 * 打开的 —— 那时没有激活的会话，退会话不会关它，因此按 label 自己关一次（label 由
 * `mountPinEdit` 提前取到）。已经关掉的窗口再关一次只会报错，忽略即可。
 *
 * @returns {Promise<void>} 收尾动作发起后结束的 Promise。
 */
async function exitOrCloseSelf() {
  try {
    await ztools.exit();
  } catch (error) {
    console.warn('[screenshot] 退出插件会话失败（继续关窗口）：', error);
  }
  if (state.ownLabel) {
    try {
      await ztools.window.close(state.ownLabel);
    } catch (error) {
      console.warn('[screenshot] 关闭本窗口失败（可能已被会话收起）：', error);
    }
  }
}

/**
 * 结束流程：复制 / 保存 / 取消。
 * @param {'copy' | 'save' | 'cancel'} kind 动作。
 * @returns {Promise<void>} 流程结束的 Promise。
 */
async function finish(kind) {
  if (state.busy) {
    return;
  }
  state.busy = true;
  try {
    if (kind !== 'cancel') {
      const sel = state.selection ? clampRect(state.selection) : null;
      if (!sel || sel.w < MIN_SIZE || sel.h < MIN_SIZE) {
        hint.textContent = '请先拖出一个截图区域';
        state.busy = false;
        return;
      }
      const dataUrl = compose();
      if (kind === 'copy') {
        await ztools.clipboard.writeImage(dataUrl);
      } else {
        const result = await ztools.screen.save(dataUrl);
        console.log('[screenshot] 已保存到', result?.path ?? '(未知路径)');
      }
    }
    // 退出插件：宿主会收起面板并关闭本次会话的所有自建窗口（本页也随之关闭）。
    await exitOrCloseSelf();
  } catch (error) {
    state.busy = false;
    hint.textContent = `操作失败：${error?.message ?? error}`;
    console.error('[screenshot] 导出失败', error);
  }
}

/**
 * 把当前选区（含标注）**钉在桌面**上：开一个常驻窗口贴住原位置，然后结束本次截图会话。
 *
 * 画面通过**插件私有存储**交给贴图窗口（`pin.payload`，读走即删）：data URL 可能有几 MB，
 * 塞进窗口地址不合适；storage 是默认允许的能力，也不需要新权限。
 * 贴图窗口按 `persistent: true` 建窗 —— 会话 `exit` 不会关它（宿主只在插件被禁用 / 卸载时关）。
 *
 * @returns {Promise<void>} 贴图窗口打开（并已退出会话）后结束的 Promise。
 */
async function pinSelection() {
  if (state.busy) {
    return;
  }
  const sel = state.selection ? clampRect(state.selection) : null;
  if (!sel || sel.w < MIN_SIZE || sel.h < MIN_SIZE) {
    hint.textContent = '请先拖出一个截图区域';
    return;
  }
  state.busy = true;
  try {
    const capture = state.capture;
    const display = state.pinDisplayRect;
    const scale = display ? display.width / capture.width : 1;
    const screen = state.screenRect || { x: capture.originX, y: capture.originY, width: capture.width, height: capture.height };
    const width = Math.max(1, Math.round(sel.w));
    const height = Math.max(1, Math.round(sel.h));
    await ztools.storage.set('pin.payload', { dataUrl: compose(), width, height });
    // pin-edit 模式：这是"把编辑后的贴图放回桌面"，先把原来那张关掉，避免同一张图钉两份。
    if (state.oldPin) {
      try {
        await ztools.window.close(state.oldPin);
      } catch (error) {
        console.warn('[screenshot] 关闭旧贴图失败（继续钉新的）：', error);
      }
      state.oldPin = null;
    }
    await ztools.window.open('pin.html', {
      title: 'ZTools 截图（钉住）',
      x: Math.round(capture.originX + sel.x * scale),
      y: Math.round(capture.originY + sel.y * scale),
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      // 隐藏建窗（页面画好再露脸）；会话结束后不关它 —— 这是"钉在桌面"。
      visible: false,
      persistent: true,
      // 虚拟屏幕边界交给贴图页做拖动/缩放时的夹取（物理像素）。
      query: new URLSearchParams({
        sx: String(screen.x),
        sy: String(screen.y),
        sw: String(screen.width),
        sh: String(screen.height),
        // 把验收模式透传给贴图页：`pin` = 自动走一遍缩放/移动/关闭；`pin-hold` = 只建贴图，
        // 由探针用**真实鼠标**驱动（量拖动跟手程度用）。
        ...(autotestKind() ? { autotest: String(autotestKind()) } : {}),
      }).toString(),
    });
    await exitOrCloseSelf();
  } catch (error) {
    state.busy = false;
    hint.textContent = `钉住失败：${error?.message ?? error}`;
    console.error('[screenshot] 钉住失败', error);
  }
}

/**
 * 当前页面的验收模式（`?autotest=copy|save|pin`；生产地址不带该参数）。
 * @returns {string | null} 模式名；没有时返回 `null`。
 */
function autotestKind() {
  return new URLSearchParams(window.location.search).get('autotest');
}

/**
 * 开始一次文本标注（在落点显示输入框，回车提交）。
 * @param {MouseEvent} event 鼠标事件。
 * @returns {void}
 */
function beginText(event) {
  if (!textInput) {
    return;
  }
  state.textAnchor = toImagePoint(event);
  textInput.hidden = false;
  textInput.value = '';
  textInput.style.left = `${event.clientX}px`;
  textInput.style.top = `${event.clientY}px`;
  textInput.style.color = state.stroke;
  textInput.style.fontSize = `${state.textFontSize * stage.getBoundingClientRect().width / state.capture.width}px`;
  textInput.focus();
}

/**
 * 从截图时的窗口 Z 序中查找鼠标下的窗口，没有应用窗口时返回全屏。
 * @param {{x: number, y: number}} point 图像像素坐标。
 * @returns {{x: number, y: number, w: number, h: number}} 候选选区。
 */
function candidateSelection(point) {
  const capture = state.capture;
  if (!state.pinDisplayRect) {
    const screenX = point.x + capture.originX;
    const screenY = point.y + capture.originY;
    const window = (capture.windows || []).find((rect) => screenX >= rect.x && screenY >= rect.y && screenX < rect.x + rect.width && screenY < rect.y + rect.height);
    if (window) {
      const x = Math.max(0, window.x - capture.originX);
      const y = Math.max(0, window.y - capture.originY);
      return { x, y, w: Math.min(capture.width, window.x - capture.originX + window.width) - x, h: Math.min(capture.height, window.y - capture.originY + window.height) - y };
    }
  }
  return { x: 0, y: 0, w: capture.width, h: capture.height };
}

/** 提交文本标注（空文本视为取消）。 */
function commitText() {
  const text = (textInput?.value || '').trim();
  if (text && state.textAnchor) {
    commitAnnotation({
      type: 'text',
      x: state.textAnchor.x,
      y: state.textAnchor.y,
      text,
      color: state.stroke,
      width: state.strokeWidth,
      fontSize: state.textFontSize,
    });
  }
  if (textInput) {
    textInput.hidden = true;
    textInput.value = '';
  }
  state.textAnchor = null;
  render();
}

/**
 * 鼠标按下：选区工具（或还没选区时）开始拉选区，其余工具开始画标注。
 * @param {MouseEvent} event 鼠标事件。
 * @returns {void}
 */
function onPointerDown(event) {
  if (event.button !== 0 || !state.image) {
    return;
  }
  const point = toImagePoint(event);
  if (state.tool === 'text' && state.selection) {
    // 阻止画布 mousedown 的默认焦点转移，否则刚 focus 的输入框会立即 blur 并关闭。
    event.preventDefault();
    beginText(event);
    return;
  }
  if (state.tool === 'select' || !state.selection) {
    state.clickSelection = candidateSelection(point);
    state.hoverSelection = null;
    state.dragOrigin = point;
    state.selection = normalize(point, point);
    state.tool = 'select';
    refreshToolButtons();
    render();
    return;
  }
  state.dragOrigin = point;
  if (state.tool === 'pen') {
    state.penPoints = [point];
    state.draft = { type: 'pen', points: state.penPoints, color: state.stroke, width: state.strokeWidth };
  } else if (state.tool === 'arrow') {
    state.draft = {
      type: 'arrow',
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      color: state.stroke,
      width: state.strokeWidth,
    };
  } else {
    state.draft = {
      type: state.tool,
      x: point.x,
      y: point.y,
      w: 0,
      h: 0,
      color: state.stroke,
      width: state.strokeWidth,
    };
  }
  render();
}

/**
 * 鼠标移动：更新选区或正在拖拽的标注。
 * @param {MouseEvent} event 鼠标事件。
 * @returns {void}
 */
function onPointerMove(event) {
  if (!state.dragOrigin) {
    if (state.image && state.tool === 'select' && !state.selection) {
      state.hoverSelection = candidateSelection(toImagePoint(event));
      render();
    }
    return;
  }
  const point = toImagePoint(event);
  if (state.tool === 'select' || !state.draft) {
    const next = normalize(state.dragOrigin, point);
    state.selection = clampRect(next);
  } else if (state.draft.type === 'pen') {
    state.penPoints.push(point);
  } else if (state.draft.type === 'arrow') {
    state.draft.x2 = point.x;
    state.draft.y2 = point.y;
  } else {
    const rect = normalize(state.dragOrigin, point);
    state.draft.x = rect.x;
    state.draft.y = rect.y;
    state.draft.w = rect.w;
    state.draft.h = rect.h;
  }
  render();
}

/**
 * 鼠标抬起：提交标注或结束选区。
 * @returns {void}
 */
function onPointerUp() {
  if (!state.dragOrigin) {
    return;
  }
  state.dragOrigin = null;
  if (state.draft) {
    if (isDraftTooSmall(state.draft)) {
      state.draft = null;
      state.penPoints = null;
    } else {
      commitAnnotation(state.draft);
      return;
    }
  }
  if (state.selection && (state.selection.w < MIN_SIZE || state.selection.h < MIN_SIZE)) {
    // 单击（两个方向位移都很小）确认窗口/全屏；细长拖拽仍按无效选区处理。
    state.selection = state.selection.w < MIN_SIZE && state.selection.h < MIN_SIZE
      ? state.clickSelection
      : null;
  }
  state.clickSelection = null;
  render();
}

/**
 * 判断正在拖拽的标注是不是"太小"（小于阈值就不提交，避免误点留下碎点）。
 *
 * 各类标注的几何字段不同，必须分开判断：**箭头**存的是两个端点（`x1/y1/x2/y2`），
 * 没有 `w/h`；早期版本统一按 `w/h` 判，`undefined ?? 0` 会被当成"太小"，
 * 于是箭头永远提交不了（表现为"箭头工具能选中，但画不出箭头"）。
 *
 * @param {object} draft 正在拖拽的标注。
 * @returns {boolean} 应该丢弃时返回 `true`。
 */
function isDraftTooSmall(draft) {
  if (draft.type === 'pen') {
    return (state.penPoints || []).length < 2;
  }
  if (draft.type === 'arrow') {
    return (
      Math.abs((draft.x2 ?? 0) - (draft.x1 ?? 0)) < MIN_SIZE &&
      Math.abs((draft.y2 ?? 0) - (draft.y1 ?? 0)) < MIN_SIZE
    );
  }
  return (draft.w ?? 0) < MIN_SIZE && (draft.h ?? 0) < MIN_SIZE;
}

/** 撤销上一条标注（没有标注时清空选区）。 */
function undo() {
  if (state.annotations.length > 0) {
    state.annotations.pop();
  } else {
    state.selection = null;
  }
  render();
}

/**
 * 键盘：Esc 取消、Enter 复制、Ctrl+Z 撤销。
 * @param {KeyboardEvent} event 键盘事件。
 * @returns {void}
 */
function onKeyDown(event) {
  // 焦点在文本输入框里时全局快捷键不生效：输入框自己会 `stopPropagation`（见 `bindEvents`），
  // 这里是兜底（不同浏览器 / IME 组合下的差异）。
  if (event.target === textInput) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    void finish('cancel');
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    void finish('copy');
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
}

/**
 * 装载捕获：铺满画布并显示工具条。
 * @param {object} capture 宿主捕获结果。
 * @returns {Promise<void>} 位图解码完成后结束的 Promise。
 */
function applyCapture(capture) {
  state.capture = capture;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      mountImage(image);
      resolve();
    };
    image.onerror = () => reject(new Error('截图解码失败'));
    image.src = capture.dataUrl;
  });
}

/**
 * 把一张已经准备好的图（`Image` 或 `Canvas`）装进画布：摆好舞台尺寸、显示工具条、重绘。
 *
 * # 参数
 * - `source`：`HTMLImageElement`（整屏抓图）或 `HTMLCanvasElement`（pin-edit 模式合成出来的
 *   "虚拟屏幕 + 贴图"底图）。
 *
 * # 返回
 * 无返回值。
 */
function mountImage(source) {
  const capture = state.capture;
  state.image = source;
  // 画布后备存储用物理像素，CSS 尺寸按 DPI 折回逻辑像素，于是 1:1 铺满窗口。
  const dpr = window.devicePixelRatio || 1;
  stage.width = capture.width;
  stage.height = capture.height;
  stage.style.width = `${capture.width / dpr}px`;
  stage.style.height = `${capture.height / dpr}px`;
  toolbar.hidden = false;
  refreshToolButtons();
  render();
}

/**
 * pin-edit 模式：编辑一张**已经钉在桌面上的贴图**（而不是整屏抓图）。
 *
 * 由贴图页的右键菜单「编辑」进入：贴图页把图（`edit.payload`，读走即删）与它当前的屏幕矩形、
 * 虚拟屏幕几何写进插件存储 / 查询串。本页直接加载贴图原图，预置整图选区，
 * 不捕获屏幕，也不构造整屏底图；按当前贴图显示尺寸预览，导出保留原图分辨率。
 * 用户点「钉住」时，如果带着旧贴图的 label（`oldPin`），会先把旧贴图关掉，避免同一张图钉两份。
 *
 * @param {URLSearchParams} params 当前页面地址的查询参数。
 * @returns {Promise<void>} 贴图编辑器装载完成。
 */
async function mountPinEdit(params) {
  const parseRect = (value) => {
    const parts = String(value ?? '')
      .split(',')
      .map((item) => Number(item) || 0);
    return { x: parts[0] ?? 0, y: parts[1] ?? 0, width: parts[2] ?? 0, height: parts[3] ?? 0 };
  };
  const pinRect = parseRect(params.get('rect'));
  state.pinDisplayRect = pinRect;
  state.screenRect = parseRect(params.get('screen'));
  state.oldPin = params.get('oldPin') || null;
  const payload = await ztools.storage.get('edit.payload');
  await ztools.storage.remove('edit.payload');
  if (!payload?.dataUrl || !payload.width || !payload.height) {
    throw new Error('没有可编辑的贴图内容');
  }
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('贴图解码失败'));
    image.src = payload.dataUrl;
  });
  state.capture = {
    width: payload.width,
    height: payload.height,
    originX: pinRect.x,
    originY: pinRect.y,
    dataUrl: payload.dataUrl,
  };
  const own = await ztools.window.setBounds({});
  state.ownLabel = own?.label ?? null;
  document.body.classList.add('pin-edit');
  mountImage(image);
  const dpr = window.devicePixelRatio || 1;
  stage.style.width = `${pinRect.width / dpr}px`;
  stage.style.height = `${pinRect.height / dpr}px`;
  stage.style.position = 'absolute';
  stage.style.left = `${Math.max(0, (pinRect.x - own.x) / dpr)}px`;
  stage.style.top = `${Math.max(0, (pinRect.y - own.y) / dpr)}px`;
  // 选区预置成贴图本身：进来就能直接改标注 / 再钉回去。
  state.selection = {
    x: 0,
    y: 0,
    w: payload.width,
    h: payload.height,
  };
  render();
  hint.textContent = '编辑贴图：拖选区域 + 标注 · Enter 复制 · 「钉住」放回桌面 · Esc 取消';
  // 验收模式：先让探针看清"编辑器打开了"，再自动钉回去 —— 顺便把"钉住会替换掉原来那张贴图"
  // 这条路径也纳入自动验收（选区预置成原贴图，所以新贴图会落回原位）。
  if (autotestKind()) {
    window.setTimeout(() => void pinSelection(), 2500);
  }
}

/** 绑定交互与工具条。 */
function bindEvents() {
  stage.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  toolbar?.addEventListener('click', (event) => {
    const clicked = event.target;
    if (!(clicked instanceof Element)) {
      return;
    }
    // 图标按钮内部有 span；统一取最近的 button，避免点击图标时丢失工具/动作。
    const target = clicked.closest('button');
    if (!(target instanceof HTMLButtonElement) || !toolbar.contains(target)) {
      return;
    }
    if (target.dataset.tool) {
      state.tool = target.dataset.tool;
      if (state.tool === 'select') {
        state.selection = null;
        state.hoverSelection = null;
        render();
      }
      refreshToolButtons();
      setToolHint();
      return;
    }
    if (target.id === 'undo') {
      undo();
    } else if (target.id === 'copy') {
      void finish('copy');
    } else if (target.id === 'save') {
      void finish('save');
    } else if (target.id === 'pin') {
      void pinSelection();
    } else if (target.id === 'cancel') {
      void finish('cancel');
    }
  });

  colorInput?.addEventListener('input', () => {
    state.stroke = colorInput.value;
    textInput.style.color = state.stroke;
  });
  sizeInput?.addEventListener('input', () => {
    const value = Number(sizeInput.value);
    if (!Number.isFinite(value) || value < Number(sizeInput.min) || value > Number(sizeInput.max)) {
      return;
    }
    if (state.tool === 'text') {
      state.textFontSize = value;
      textInput.style.fontSize = `${value * stage.getBoundingClientRect().width / state.capture.width}px`;
    } else {
      state.strokeWidth = value;
    }
  });
  textInput?.addEventListener('keydown', (event) => {
    // 输入框里的按键**不能**冒泡到窗口级快捷键：否则"回车提交文本"会被当成"Enter 复制" ——
    // 整张图被复制走、截图会话当场结束（Esc 同理会变成"取消截图"）。这就是文本工具此前
    // 不可用的根因（能输入、但一提交整个流程就结束），必须 stopPropagation。
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      commitText();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      textInput.value = '';
      commitText();
    }
  });
  textInput?.addEventListener('blur', () => {
    if (!textInput.hidden) {
      commitText();
    }
  });
}

/**
 * 页面启动：取回宿主最近一次捕获（没有就现抓一张），装载并绑定交互。
 * @returns {Promise<void>} 启动完成的 Promise。
 */
async function boot() {
  bindEvents();
  try {
    const params = new URLSearchParams(window.location.search);
    const isPinEdit = params.get('source') === 'pin-edit';
    if (isPinEdit) {
      // 「编辑贴图」：底图来自插件存储里的贴图，不走整屏抓图（也不需要 screen.capture 权限）。
      await mountPinEdit(params);
    } else {
      const capture = (await ztools.screen.fetch()) ?? (await ztools.screen.capture());
      if (!capture) {
        throw new Error('没有可用的屏幕捕获');
      }
      await applyCapture(capture);
      setToolHint();
    }
    // 冻结帧已经在画布上了，这时才让窗口露脸（隐藏建窗，见文件头说明）。
    await revealWindow();
    // 验收辅助：`?autotest=copy|save|pin|pin-hold|edit` 时自动框一块区域并执行动作（生产地址不带该参数）。
    const autotest = autotestKind();
    // `pin-edit`（编辑贴图）不跑这套自检动作：它由 `mountPinEdit` 自己安排"等一会儿再钉回去"，
    // 免得自检的选区与标注把"编辑后再钉"的路径覆盖掉。
    if (
      !isPinEdit &&
      (autotest === 'copy' || autotest === 'save' || autotest === 'pin' || autotest === 'pin-hold')
    ) {
      runAutotest(autotest);
    }
  } catch (error) {
    hint.textContent = `无法加载截图：${error?.message ?? error}`;
    console.error('[screenshot] overlay 启动失败', error);
    // 出错也要露脸：窗口是隐藏建窗的，不显示的话用户只看到"什么都没发生"
    // （宿主 5s 后也会兜底显示，这里不等它）。
    await revealWindow();
  }
}

/**
 * 让本页所在的插件窗口显示出来（隐藏建窗的"画好再露脸"）。
 *
 * 显示失败的兜底在宿主侧（`visible: false` 建窗会挂一个 5s 的兜底显示），这里只记录日志。
 *
 * @returns {Promise<void>} 显示调用返回后结束的 Promise。
 */
async function revealWindow() {
  try {
    await ztools.window.show();
  } catch (error) {
    console.error('[screenshot] 显示选区窗口失败：', error);
  }
}

/**
 * 验收辅助：把图像坐标换算成页面客户区坐标。
 * @param {{x: number, y: number}} point 图像（物理）像素坐标。
 * @returns {{clientX: number, clientY: number}} 客户区坐标。
 */
function toClientPoint(point) {
  const rect = stage.getBoundingClientRect();
  const scale = state.capture.width > 0 ? rect.width / state.capture.width : 1;
  return { clientX: rect.left + point.x * scale, clientY: rect.top + point.y * scale };
}

/**
 * 验收辅助：合成一次真实拖拽（mousedown → mousemove → mouseup）。
 *
 * 走的是和用户一样的处理函数，因此能覆盖"按下 / 移动 / 抬起 → 提交标注"整条链路。
 *
 * @param {{x: number, y: number}} from 起点（图像像素）。
 * @param {{x: number, y: number}} to 终点（图像像素）。
 * @returns {void}
 */
function synthesizeDrag(from, to) {
  const start = toClientPoint(from);
  const end = toClientPoint(to);
  stage.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, ...start }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 0, ...end }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, ...end }));
}

/**
 * 验收辅助：自动框一块区域 + 一条矩形 + 一条**用真实指针事件画出来的箭头** + 一段**走真实
 * 输入路径的文字**，然后复制 / 保存 / 钉住。
 *
 * 箭头固定用纯洋红 `#ff00ff`：探针在导出的图里直接找这些像素，就能判定"箭头工具真的留下了笔迹"
 * （回归：早期版本箭头在鼠标抬起时被当成"太小"丢弃，画不出来）。
 * 文本固定用纯青 `#00ffff`，并**用真实的 `keydown` 回车提交**：探针除了在导出图里找青色像素，
 * 还能据此判定"回车提交文本没有冒泡成 Enter 复制"（回归：文本工具此前一提交就结束整个会话）。
 *
 * @param {'copy' | 'save' | 'pin' | 'pin-hold'} kind 动作（`pin-hold` = 只钉住、不自动操作，
 *   留给探针用真实鼠标驱动贴图）。
 * @returns {void}
 */
function runAutotest(kind) {
  const width = Math.min(320, state.capture.width);
  const height = Math.min(200, state.capture.height);
  state.selection = { x: 40, y: 40, w: width, h: height };
  state.annotations.push({
    type: 'rect',
    x: 60,
    y: 60,
    w: 120,
    h: 80,
    color: '#ff3b30',
    width: state.strokeWidth,
  });
  // 文本：选中文本工具 → 在画面上按下（和用户一样走 `onPointerDown` → `beginText`）→
  // 填好输入框 → 派发**真实的回车事件**提交（这条路径以前会把会话直接结束掉）。
  //
  // 刻意放在箭头**之前**：文本回车一旦冒泡成"Enter 复制"，会话会当场结束，后面的箭头就画不出来 ——
  // 于是验收脚本里既有的 `arrow_tool_draws` 检查同时成了"文本提交不再吃快捷键"的回归哨兵。
  state.stroke = '#00ffff';
  state.tool = 'text';
  refreshToolButtons();
  setToolHint();
  const textAnchor = toClientPoint({ x: 120, y: 100 });
  stage.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, button: 0, ...textAnchor }),
  );
  if (textInput && !textInput.hidden) {
    textInput.value = 'ZTools';
    textInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  const textCommitted = state.annotations.some((shape) => shape.type === 'text');
  state.stroke = '#ff00ff';
  state.tool = 'arrow';
  refreshToolButtons();
  synthesizeDrag({ x: 90, y: 150 }, { x: 300, y: 205 });
  state.tool = 'select';
  refreshToolButtons();
  setToolHint();
  render();
  const arrowCommitted = state.annotations.some((shape) => shape.type === 'arrow');
  console.log(
    `[screenshot] autotest=${kind} selection=${width}x${height} arrow=${arrowCommitted} text=${textCommitted} busy=${state.busy}`,
  );
  if (kind === 'pin' || kind === 'pin-hold') {
    window.setTimeout(() => void pinSelection(), 600);
    return;
  }
  // 留一点可见时间，供验收脚本按窗口标题截图取证。
  window.setTimeout(() => void finish(kind), 1200);
}

void boot();
