/**
 * 截图插件入口页（插件叠加窗口里的那一小页）。
 *
 * 只用 SDK 访问宿主（`07 §5`：插件不直接引用 `@tauri-apps/api`）：
 * - `ztools.screen.capture()`：宿主先收起主面板与插件窗口，再抓虚拟屏幕，返回 PNG data URL 与几何；
 * - `ztools.window.open()`：按**物理像素**开一个盖住虚拟屏幕的窗口加载 `overlay.html`。
 *
 * 捕获结果留在宿主（`ScreenshotState`），选区窗口用 `ztools.screen.fetch()` 取回同一张图——
 * 不能再抓一次，否则会把刚显示出来的选区窗口一起拍进去。
 */
import { bootstrap, ztools } from './vendor/ztools-sdk/index.js';

/** 状态文本容器。 */
const statusElement = document.getElementById('status');

/**
 * 更新页面上的状态文本。
 * @param {string} text 文本。
 * @returns {void}
 */
function setStatus(text) {
  if (statusElement) {
    statusElement.textContent = text;
  }
}

/**
 * 启动一次截图：捕获全屏 → 打开覆盖虚拟屏幕的选区窗口。
 *
 * 选区窗口按 `visible: false` **隐藏建窗**，等 `overlay.html` 把冻结帧画进画布后再由它
 * `ztools.window.show()` 露脸：窗口若是建好就显示，用户会先看到一个空白全屏窗口、
 * 再切换到冻结帧（实测整屏白帧约 60–100ms，就是"屏幕闪一下"）。
 *
 * @returns {Promise<void>} 流程结束（窗口交给 overlay 页）后结束的 Promise。
 */
async function startCapture() {
  try {
    setStatus('正在捕获屏幕…');
    const capture = await ztools.screen.capture();
    setStatus(`已捕获 ${capture.width}×${capture.height}，正在打开选区窗口…`);
    await ztools.window.open('overlay.html', {
      // 标题与宿主内置截图窗口（"ZTools 截图"）区分开，便于验收脚本按标题定位插件窗口。
      title: 'ZTools 截图（插件）',
      x: capture.originX,
      y: capture.originY,
      width: capture.width,
      height: capture.height,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focus: true,
      // 隐藏建窗：overlay 页画好冻结帧后自己调 `ztools.window.show()` 露脸（宿主兜底 5s 显示）。
      visible: false,
    });
    setStatus('选区窗口已打开。');
  } catch (error) {
    setStatus(`截图失败：${error?.message ?? error}`);
    console.error('[screenshot] 捕获失败：', error);
  }
}

// 用户是用「截图」功能码进来的：进入即开始截图。
bootstrap({
  async onEnter() {
    await startCapture();
  },
});

document.getElementById('retry')?.addEventListener('click', () => {
  void startCapture();
});
