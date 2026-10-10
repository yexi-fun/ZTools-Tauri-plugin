/**
 * ZTools 插件 SDK 入口（M2 首批能力）。
 *
 * 插件只能通过本包访问宿主能力，禁止直接引用 `@tauri-apps/api`（`02 §2`）。
 * 命名空间与设计一一对应：`07 §4` 的 `ztools.{clipboard,storage,ui,events,features}`；
 * 按 `02 §8` **不提供** `ztools.ai` / `ztools.payment`（Q6/Q4 已移出范围）。
 *
 * 典型用法：
 * ```ts
 * import { bootstrap, ztools } from '@ztools/sdk'
 *
 * bootstrap({
 *   async onEnter({ featureCode }) {
 *     const text = await ztools.clipboard.readText()
 *     await ztools.storage.set('last', { featureCode, text })
 *     await ztools.ui.showNotification({ title: '已进入', body: featureCode })
 *   },
 *   onExit() { console.log('bye') },
 * })
 * ```
 */
import { requireBridge } from './bridge.js';
import { call } from './commands.js';
import { ZToolsApiError } from './errors.js';
export { ZToolsApiError } from './errors.js';
export { isBridgeAvailable, requireBridge } from './bridge.js';
export { call } from './commands.js';
/** SDK 契约版本号，随跨边界 API 的破坏性变更递增。 */
export const SDK_VERSION = '0.2.0';
/**
 * 读取剪贴板文本。
 * @returns 剪贴板文本。
 * @throws 未声明 `clipboard.read` 时抛出 `PermissionDenied`。
 */
async function readClipboardText() {
    return call('clipboard_read_text');
}
/**
 * 写入剪贴板文本。
 * @param text 要写入的文本。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `clipboard.write` 时抛出 `PermissionDenied`。
 */
async function writeClipboardText(text) {
    await call('clipboard_write_text', { text });
}
/**
 * 把 PNG 图片写入系统剪贴板。
 * @param dataUrl `data:image/png;base64,...`。
 * @returns 复制结果。
 * @throws 未声明 `clipboard.write` 时抛出 `PermissionDenied`。
 */
async function writeClipboardImage(dataUrl) {
    return call('clipboard_write_image', { dataUrl });
}
/**
 * 全屏截图（捕获前宿主会先收起主面板与插件窗口，避免把界面拍进去）。
 * @returns 捕获结果（含可直接渲染的 `dataUrl` 与虚拟屏幕几何）。
 * @throws 未声明 `screen.capture` 时抛出 `PermissionDenied`。
 */
async function captureScreen() {
    return call('screen_capture');
}
/**
 * 读取最近一次全屏截图（插件自己的全屏窗口用它取回 `captureScreen` 抓好的那张图）。
 * @returns 捕获结果；尚未捕获时为 `null`。
 * @throws 未声明 `screen.capture` 时抛出 `PermissionDenied`。
 */
async function fetchScreenCapture() {
    return call('screen_capture_fetch');
}
/**
 * 把 PNG 保存到宿主截图目录 `<data_root>/screenshots/`。
 * @param dataUrl `data:image/png;base64,...`。
 * @param fileName 可选文件名（不含路径分隔符）。
 * @returns 保存结果（含绝对路径）。
 * @throws 未声明 `screen.capture` 时抛出 `PermissionDenied`。
 */
async function saveScreenshot(dataUrl, fileName) {
    return call('screenshot_save_png', { dataUrl, fileName });
}
/**
 * 打开一个插件自建窗口（页面必须是插件目录内的相对 `.html`）。
 * @param entry 相对入口，如 `overlay.html`。
 * @param options 窗口参数（物理像素位置/尺寸、边框、置顶等）。
 * @returns 新窗口 label（用 {@link closePluginWindow} 关闭）。
 * @throws 未声明 `window.create` 或入口非法时抛出错误。
 */
async function openPluginWindow(entry, options) {
    return call('plugin_window_open', { entry, options });
}
/**
 * 关闭一个插件自建窗口（只能关自己的窗口）。
 * @param label `openPluginWindow` 返回的 label。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `window.create` 或窗口不属于本插件时抛出错误。
 */
async function closePluginWindow(label) {
    await call('plugin_window_close', { label });
}
/**
 * 显示**自己所在的**插件自建窗口。
 *
 * 配合 `open` 的 `visible: false` 使用：窗口先隐藏建好，页面把内容（如冻结帧）画完之后再调用
 * 本方法露脸，避免"窗口先白屏、再画出内容"的闪屏。窗口由宿主按**调用方所在窗口**反查，
 * 因此不需要传 label，插件也只能显示自己的窗口；已经显示的窗口再调无副作用。
 *
 * @returns 无返回值的 Promise。
 * @throws 未声明 `window.create`、调用方不在插件自建窗口里或窗口已关闭时抛出错误。
 */
async function showPluginWindow() {
    await call('plugin_window_show');
}
/**
 * 弹出**原生右键菜单**并返回选中项的 id（用户点空白处 / 按 Esc 取消时返回 `null`）。
 *
 * 为什么用原生菜单：插件窗口可能很小（截图插件的贴图可以只有几十像素宽），页面内 HTML 菜单会被
 * 窗口边界裁掉；原生菜单不受宿主窗口限制，键盘上下键 / Esc 由系统处理。
 *
 * @param items 菜单项（顺序即显示顺序；可标 `separatorBefore` 插分隔线）。
 * @returns 选中项 id；取消返回 `null`。
 * @throws 调用方不在插件自建窗口里、或目标窗口不属于本插件时抛出错误。
 */
async function contextMenu(items) {
    const choice = await call('plugin_window_context_menu', { items });
    return (choice ?? null);
}
/**
 * 移动 / 缩放本插件的自建窗口（截图插件"钉在桌面"的贴图靠它做拖动与边缘缩放）。
 *
 * 参数与返回值都是**物理像素的客户区矩形**：`x` / `y` 是客户区左上角的屏幕坐标，
 * `width` / `height` 是客户区尺寸；只传要改的字段，其余按当前值。宿主会补掉无边框窗口的
 * 隐形边框与 DPI 折算偏差，因此返回值就是画布实际占的矩形（贴图不会被错位或拉伸）。
 *
 * @param bounds 目标客户区；`label` 省略时表示调用方自己所在的窗口。
 * @returns 应用后的实际客户区。
 * @throws 目标窗口不属于本插件、窗口已关闭或尺寸非法时抛出错误。
 */
async function setPluginWindowBounds(bounds) {
    const rect = await call('plugin_window_set_bounds', { bounds: bounds ?? {} });
    return (rect ?? {});
}
/**
 * 读取插件私有存储。
 * @param key 键。
 * @returns 值；不存在返回 `null`。
 */
async function storageGet(key) {
    const value = await call('storage_get', { key });
    return (value ?? null);
}
/**
 * 写入插件私有存储。
 * @param key 键。
 * @param value 任意可序列化值。
 * @returns 无返回值的 Promise。
 */
async function storageSet(key, value) {
    await call('storage_set', { key, value });
}
/**
 * 删除存储键。
 * @param key 键。
 * @returns 删除前是否存在。
 */
async function storageRemove(key) {
    return call('storage_remove', { key });
}
/**
 * 列出全部存储条目。
 * @returns 条目列表。
 */
async function storageList() {
    return call('storage_list');
}
/**
 * 清空插件私有存储。
 * @returns 无返回值的 Promise。
 */
async function storageClear() {
    await call('storage_clear');
}
/**
 * 弹通知（M2 由宿主前端 toast；系统通知在 M3）。
 * @param input 标题/正文，或直接给标题字符串。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `notification.show` 时抛出 `PermissionDenied`。
 */
async function showNotification(input) {
    const payload = typeof input === 'string' ? { title: input } : input;
    await call('ui_notify', { title: payload.title, body: payload.body });
}
/**
 * 在主面板里显示一个"子输入框"（`ztools.ui.subInput`，T7-1）。
 *
 * 对应旧 `setSubInput(onChange, placeholder, isFocus)`：回调改由
 * {@link onSubInputChange} 单独注册（事件不排队，建议在模块顶层注册）。
 * @param options 占位提示与焦点/全选意图（`isFocus` 默认 `true`）。
 * @returns 无返回值的 Promise。
 * @throws 宿主桥不可用时抛出 `Unsupported`。
 */
async function setSubInput(options = {}) {
    const patch = {
        placeholder: options.placeholder,
        visible: true,
        focus: options.isFocus ?? true,
        select: options.isSelect === true,
    };
    await call('plugin_ui_sub_input', { patch });
}
/**
 * 收起并移除子输入框（主面板恢复为普通搜索框）。
 * @returns 无返回值的 Promise。
 */
async function removeSubInput() {
    await call('plugin_ui_sub_input', { patch: { visible: false } });
}
/**
 * 把值写入主面板的子输入框（只改值，不会触发 {@link onSubInputChange}）。
 * @param value 要写入的文本。
 * @returns 无返回值的 Promise。
 */
async function setSubInputValue(value) {
    await call('plugin_ui_sub_input', { patch: { value } });
}
/**
 * 让子输入框获得焦点。
 * @returns 无返回值的 Promise。
 */
async function subInputFocus() {
    await call('plugin_ui_sub_input', { patch: { focus: true } });
}
/**
 * 让子输入框获得焦点并全选内容。
 * @returns 无返回值的 Promise。
 */
async function subInputSelect() {
    await call('plugin_ui_sub_input', { patch: { select: true } });
}
/**
 * 让子输入框失去焦点（焦点交回插件页）。
 * @returns 无返回值的 Promise。
 */
async function subInputBlur() {
    await call('plugin_ui_sub_input', { patch: { focus: false } });
}
/**
 * 订阅子输入框内容变化（宿主推 `sub-input` 命名事件）。
 * @param handler 处理器；主面板把输入值投递过来时触发。
 * @returns 取消订阅函数。
 */
function onSubInputChange(handler) {
    return requireBridge().on('sub-input', (payload) => {
        if (typeof payload === 'string') {
            handler(payload);
        }
    });
}
/**
 * 请求主面板的内容区高度（`ztools.ui.setHeight`，T7-1）。
 * @param height 目标高度（逻辑像素）。
 * @returns 无返回值的 Promise。
 */
async function setHeight(height) {
    await call('plugin_ui_set_height', { height });
}
/**
 * 把当前插件视图分离到独立窗口（`ztools.ui.detach`，T7-11，需 `window.create`）。
 *
 * 语义：
 * - 宿主用插件自己的入口开一个普通可移动窗口（有标题栏 / 关闭按钮 / 占任务栏），
 *   叠加窗口（主面板里的插件内容区）随即隐藏但**不销毁**；
 * - 分离窗口的页面会收到 `onPluginDetach` 与随后的 `onEnter`（当前功能码 + 载荷）；
 * - 用户关闭该窗口（或插件自己 `ztools.window.close(label)`）后，宿主会把当前功能
 *   重新 `enter` 回主面板（"吸附"）。
 *
 * 与 `ztools.window.open` 的区别：`window.open` 是插件**自己**开一个附加窗口（主面板里的
 * 插件视图照旧存在）；`detach` 是把**当前视图搬走**，两者只能有一个在承载这个功能。
 *
 * @returns 分离窗口的 label（可用 `ztools.window.close(label)` 关闭）。
 * @throws 未声明 `window.create`、已有分离窗口或调用方不是主面板里的插件视图时抛出对应错误。
 */
async function detachUI() {
    return call('plugin_ui_detach');
}
/**
 * 打开本插件 webview 的开发者工具（`ztools.ui.devtools`，T7-12）。
 *
 * **只在开发模式下可用**：宿主启动时把 `ZTOOLS_PLUGIN_DEV` 设为该插件 id（或 `*`）。
 * 该模式下 `development.entry` 指向的 dev server（`http://127.0.0.1:*` / `http://localhost:*`）
 * 属 Tauri 的远程来源，宿主会临时追加一个"只作用于远程来源 + 只给插件窗口 + 只放行 SDK 命令"
 * 的 capability（见 `src-tauri/src/dev_acl.rs`），因此 dev 页面里的 `ztools.*` 与生产一致可用。
 *
 * @returns 无返回值的 Promise（开发者工具是独立窗口，宿主不等待它关闭）。
 * @throws 非开发模式或当前构建未启用开发者工具时抛出 `Unsupported`。
 */
async function devtoolsUI() {
    await call('plugin_devtools');
}
/**
 * 本插件的缓存目录绝对路径（`ztools.files.cacheDir()`，T7-13）。
 *
 * 目录是 `<data_root>/cache/<plugin-id>/`：**可清理**（宿主/用户可随时删），
 * 与私有 `storage`（`<plugin_dir>/data/`，卸载默认保留）分工不同——需要长期保留的数据放
 * `storage`，能重算的中间产物放这里。
 *
 * 该目录连同子目录对**本插件**是隐式读写范围（无需用户先经对话框授权），
 * 因此可以直接配合 `ztools.fs` 使用：
 *
 * ```ts
 * const dir = await ztools.files.cacheDir()
 * await ztools.fs.writeText(`${dir}\\thumbnail.png`, base64)
 * ```
 *
 * @returns 缓存目录的绝对路径。
 * @throws 不在插件窗口时抛出 `PermissionDenied`。
 */
async function cacheDir() {
    return call('plugin_cache_dir');
}
/**
 * 打开系统的"选择文件"对话框（`ztools.dialog.openFile`，T7-2，需 `dialog.open`）。
 * @param options 标题 / 默认路径 / 过滤器 / 是否选目录。
 * @returns 选中项的绝对路径；用户取消时返回 `null`。
 * @throws 未声明 `dialog.open` 或参数非法时抛出对应错误。
 */
async function openFile(options = {}) {
    return call('dialog_open_file', { options });
}
/**
 * 打开系统的"保存文件"对话框（`ztools.dialog.saveFile`，T7-2，需 `dialog.open`）。
 *
 * 只在用户确认时返回路径，**不会真的写文件**——写文件需要 `fs.write.any`（见 T7-6）。
 * @param options 标题 / 默认路径 / 过滤器。
 * @returns 目标绝对路径；用户取消时返回 `null`。
 * @throws 未声明 `dialog.open` 或参数非法时抛出对应错误。
 */
async function saveFile(options = {}) {
    return call('dialog_save_file', { options });
}
/**
 * 弹出系统消息对话框（`ztools.dialog.showMessage`，T7-2，需 `dialog.open`）。
 * @param options 标题 / 正文 / 语气，或直接给正文字符串。
 * @returns 用户关闭对话框后结束的 Promise。
 * @throws 未声明 `dialog.open`、正文为空或 `kind` 非法时抛出对应错误。
 */
async function showMessage(options) {
    const payload = typeof options === 'string' ? { message: options } : options;
    await call('dialog_show_message', { options: payload });
}
/**
 * 读取拖入的 `File` 在磁盘上的真实路径。
 *
 * **本函数不伪造路径**：WebView2 出于安全限制不把 `File` 的真实路径暴露给页面
 * （`File.path` 为空、`webkitRelativePath` 只是相对路径），宿主拿不到也没有可信来源。
 * 需要真实路径时请改用 {@link openFile}（由宿主弹出系统对话框并回填路径），
 * 或在 T7-9 的拖放落点里使用宿主回填的路径。
 * @param _file 拖入的 `File`（本实现不使用它，保留参数以对齐旧 API 签名）。
 * @returns 永不返回。
 * @throws 始终抛出 `Unsupported`，并说明替代方案。
 */
function getPathForFile(_file) {
    throw new ZToolsApiError('Unsupported', 'WebView2 不向页面暴露 File 的真实路径；请用 ztools.dialog.openFile() 让宿主选择文件并返回路径');
}
/**
 * 用系统默认程序打开外链（`ztools.shell.openExternal`，T7-3，需 `shell.openExternal`）。
 *
 * 只放行 `http` / `https` / `mailto` / `tel`。**`file:` 与自定义协议一律被宿主拒绝**
 * （`file:` 等于把本地文件交给默认程序执行，自定义协议可能拉起任意已注册处理程序）。
 * @param url 目标 URL。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `shell.openExternal`、协议不允许或系统没有对应处理程序时抛出错误。
 */
async function openExternal(url) {
    await call('plugin_shell_open_external', { url });
}
/**
 * 用资源管理器打开路径（`ztools.shell.openPath`，T7-3，需 `shell.openExternal`）。
 * @param path 目标文件或目录（必须存在）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `shell.openExternal`、路径为空或不存在时抛出错误。
 */
async function openPath(path) {
    await call('plugin_shell_open_path', { path });
}
/**
 * 在资源管理器中定位（选中）路径（`ztools.shell.showItemInFolder`，T7-3，需 `shell.openExternal`）。
 * @param path 目标文件或目录（必须存在）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `shell.openExternal`、路径为空或不存在时抛出错误。
 */
async function showItemInFolder(path) {
    await call('plugin_shell_show_item_in_folder', { path });
}
/**
 * 把路径送入系统回收站（`ztools.shell.trash`，T7-3，需 `shell.openExternal`）。
 *
 * 走 Windows `SHFileOperationW` + `FOF_ALLOWUNDO`（**可还原**），且不弹确认框——
 * 是否删除必须由插件自己问用户。
 * @param path 目标文件或目录（必须存在）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `shell.openExternal`、路径为空或不存在、系统调用失败时抛出错误。
 */
async function trashItem(path) {
    await call('plugin_shell_trash', { path });
}
/**
 * 播放系统默认提示音（`ztools.shell.beep`，T7-3，需 `shell.openExternal`）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `shell.openExternal` 或系统调用失败时抛出错误。
 */
async function beep() {
    await call('plugin_shell_beep');
}
/**
 * 发起一次受限 HTTP 请求（`ztools.http.request`，T7-4，需 `network`）。
 *
 * 请求由**宿主侧**发出（插件页不直连，宿主页面的 CSP 不放宽）。宿主侧的"受限"边界：
 * - 只允许 `http` / `https`；
 * - 默认拦截本机/私网目标（`localhost`、回环、私网网段，以及域名解析到这些地址的情况）；
 * - 单次超时默认 15s（`timeoutMs` 只能调小）、请求体 ≤ 256 KiB；
 * - 响应体 ≤ 1 MiB，**超过直接报错**（不静默截断）；
 * - **不自动跟随重定向**：3xx 原样返回。
 * @param options 或直接给 URL 字符串。
 * @returns 响应（`status` / `headers` / `body` / `url` / `size`）。
 * @throws 未声明 `network`、协议/方法/头非法、私网拦截、超时或响应超限时抛出错误。
 */
async function httpRequest(options) {
    const payload = typeof options === 'string' ? { url: options } : options;
    return call('plugin_http_request', { request: payload });
}
/**
 * 模拟一次键盘动作（`ztools.input.key`，T7-5，需 `input.simulate`）。
 *
 * `SendInput` 只把事件投递给**当前前台窗口**：调用前请自行确保目标窗口已激活
 * （宿主不会替你抢焦点）。
 * @param key 键名：单个字母/数字（`a`…`z` / `0`…`9`）、`Enter`/`Return`、`Tab`、`Esc`、
 *   `Space`、`Backspace`、`Delete`、`Insert`、`Home`/`End`、`PageUp`/`PageDown`、
 *   `Up`/`Down`/`Left`/`Right`、`F1`…`F12`、`CapsLock`、`Numpad0`…`9`、
 *   `NumpadAdd`/`NumpadSubtract`/`NumpadMultiply`/`NumpadDivide`/`NumpadDecimal`、
 *   `Minus`/`Equal`/`Comma`/`Period`。（未知键名会报错，不会被静默忽略。）
 * @param modifiers 修饰键：`ctrl` / `alt` / `shift` / `win`。
 * @param action `tap`（默认，按下并抬起）/ `down` / `up`（按住场景自行配对）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `input.simulate`、键名/修饰键/动作非法或注入失败时抛出错误。
 */
async function inputKey(key, modifiers = [], action = 'tap') {
    await call('plugin_input_key', { key, modifiers, action });
}
/**
 * 输入一段文本（`ztools.input.type`，T7-5，需 `input.simulate`）。
 *
 * 走 Unicode 注入：与键盘布局/输入法无关，中文等非 ASCII 文本也能输入。
 * @param text 要输入的文本（不能为空）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `input.simulate`、文本为空或注入失败时抛出错误。
 */
async function inputType(text) {
    await call('plugin_input_type', { text });
}
/**
 * 模拟一次鼠标动作（`ztools.input.mouse`，T7-5，需 `input.simulate`）。
 * @param options 动作与坐标（见 {@link InputMouseOptions}）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `input.simulate`、动作/坐标/按键非法或注入失败时抛出错误。
 */
async function inputMouse(options) {
    await call('plugin_input_mouse', { options });
}
/**
 * 读取剪贴板里的文件列表（`ztools.clipboard.readFiles`，T7-6，需 `clipboard.read`）。
 * @returns 文件/文件夹的绝对路径列表；剪贴板里没有文件列表时返回空数组。
 * @throws 未声明 `clipboard.read` 或系统调用失败时抛出错误。
 */
async function readClipboardFiles() {
    return call('clipboard_read_files');
}
/**
 * 把文件列表写入剪贴板（`ztools.clipboard.writeFiles`，T7-6，需 `clipboard.write`）。
 * @param paths 绝对路径列表（不能为空、数量 ≤ 1024）。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `clipboard.write`、路径不是绝对路径或系统调用失败时抛出错误。
 */
async function writeClipboardFiles(paths) {
    await call('clipboard_write_files', { paths });
}
/**
 * 列出剪贴板历史（`ztools.clipboard.history`，需 `clipboard.read`）。
 * @param options 关键字与返回上限（1..500，默认 50）。
 * @returns 条目列表（新在前）。
 * @throws 未声明 `clipboard.read` 或未获用户授权时抛出 `PermissionDenied`。
 */
async function listClipboardHistory(options) {
    return call('plugin_clipboard_history_list', {
        query: options?.query ?? null,
        limit: options?.limit,
    });
}
/**
 * 粘贴一条历史（`ztools.clipboard.pasteHistory`，需 `clipboard.write`）：
 * 宿主把该条写回系统剪贴板，并按设置决定是否注入 `Ctrl+V` 到前台窗口。
 * @param id 条目 id。
 * @returns 被粘贴的条目。
 * @throws 条目不存在抛 `NotFound`；未授权抛 `PermissionDenied`。
 */
async function pasteClipboardHistory(id) {
    return call('plugin_clipboard_history_paste', { id });
}
/**
 * 删除单条历史（`ztools.clipboard.removeHistory`，需 `clipboard.write`）。
 * @param id 条目 id。
 * @returns 删除前是否存在。
 */
async function removeClipboardHistory(id) {
    return call('plugin_clipboard_history_remove', { id });
}
/**
 * 清空历史（`ztools.clipboard.clearHistory`，需 `clipboard.write`）。
 * @returns 删除的条目数。
 */
async function clearClipboardHistory() {
    return call('plugin_clipboard_history_clear');
}
/**
 * 把一条图片历史转成 PNG data URL（`ztools.clipboard.historyImage`，需 `clipboard.read`）。
 * 磁盘上保留的是原始 `CF_DIB`，webview 无法直接渲染，因此按需转换。
 * @param id 条目 id（必须是图片条目）。
 * @returns `data:image/png;base64,...`。
 */
async function clipboardHistoryImage(id) {
    return call('plugin_clipboard_history_image', { id });
}
/**
 * 读取剪贴板监视与历史状态（`ztools.clipboard.status`，需 `clipboard.read`）。
 * @returns 监视与历史状态。
 */
async function clipboardStatus() {
    return call('plugin_clipboard_status');
}
/**
 * 读取授权范围内的文本文件（`ztools.fs.readText`，T7-6）。
 *
 * **授权范围**：只有"用户在系统对话框里显式选过的路径"才可访问——
 * 先用 `ztools.dialog.openFile({ directory: true })` 让用户选目录（含子目录的读写范围），
 * 或 `openFile()` 选单个文件（该文件的只读范围）。
 * @param path 绝对路径。
 * @returns UTF-8 文本（≤ 1 MiB）。
 * @throws 未声明 `fs.read.any`、不在授权范围内（`PermissionDenied`）、文件不存在或不是 UTF-8 时抛出错误。
 */
async function fsReadText(path) {
    return call('fs_read_text', { path });
}
/**
 * 写入授权范围内的文本文件（`ztools.fs.writeText`，T7-6，≤ 1 MiB）。
 *
 * 写权限来自：用户经 `dialog.openFile({ directory: true })` 选中的目录（含子目录），
 * 或 `dialog.saveFile()` 指定的那个文件；缺失的中间目录会自动创建。
 * @param path 绝对路径。
 * @param text 要写入的文本。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `fs.write.any`、不在授权范围内（`PermissionDenied`）、路径或文本非法时抛出错误。
 */
async function fsWriteText(path, text) {
    await call('fs_write_text', { path, text });
}
/**
 * 列出授权范围内的目录（`ztools.fs.list`，T7-6，最多 2000 条）。
 * @param path 目录的绝对路径（必须在用户授权过的目录范围内）。
 * @returns 目录项列表（按名称排序）。
 * @throws 未声明 `fs.read.any`、不在授权范围内（`PermissionDenied`）或路径不是目录时抛出错误。
 */
async function fsList(path) {
    return call('fs_list', { path });
}
/**
 * 列出当前插件的功能（静态 + 动态）。
 * @returns 功能列表。
 */
async function featuresList() {
    return call('features_list');
}
/**
 * 注册/覆盖一条动态 feature。
 * @param feature 功能定义。
 * @returns 无返回值的 Promise。
 * @throws 未声明 `features.manage` 时抛出 `PermissionDenied`。
 */
async function featuresSet(feature) {
    await call('features_set', { feature });
}
/**
 * 删除一条动态 feature。
 * @param code 功能码。
 * @returns 删除前是否存在。
 */
async function featuresRemove(code) {
    return call('features_remove', { code });
}
/**
 * 退出当前插件（宿主会投递 `onExit` 并隐藏插件窗口）。
 * @returns 无返回值的 Promise。
 */
async function exitPlugin() {
    await call('plugin_exit');
}
/**
 * 订阅命名事件（宿主 → 插件）。
 * @param name 事件名。
 * @param handler 事件处理器。
 * @returns 取消订阅函数。
 */
function subscribe(name, handler) {
    return requireBridge().on(name, handler);
}
/** 插件可用的宿主能力（`07 §4` 首批）。 */
export const ztools = {
    /** 剪贴板（需 `clipboard.read` / `clipboard.write`）。 */
    clipboard: {
        readText: readClipboardText,
        writeText: writeClipboardText,
        /** 写入 PNG 图片（M4 截图插件用）。 */
        writeImage: writeClipboardImage,
        /** 读取剪贴板里的文件列表（T7-6，需 `clipboard.read`）。 */
        readFiles: readClipboardFiles,
        /** 把文件列表写入剪贴板（T7-6，需 `clipboard.write`）。 */
        writeFiles: writeClipboardFiles,
        /** 列出剪贴板历史（需 `clipboard.read`）。 */
        history: listClipboardHistory,
        /** 粘贴一条历史（写回剪贴板 + 按设置注入 Ctrl+V，需 `clipboard.write`）。 */
        pasteHistory: pasteClipboardHistory,
        /** 删除单条历史（需 `clipboard.write`）。 */
        removeHistory: removeClipboardHistory,
        /** 清空历史（需 `clipboard.write`）。 */
        clearHistory: clearClipboardHistory,
        /** 图片历史转 PNG data URL（需 `clipboard.read`）。 */
        historyImage: clipboardHistoryImage,
        /** 剪贴板监视与历史状态（需 `clipboard.read`）。 */
        status: clipboardStatus,
    },
    /** 截图（需 `screen.capture`）。 */
    screen: {
        capture: captureScreen,
        fetch: fetchScreenCapture,
        save: saveScreenshot,
    },
    /** 插件自建窗口（需 `window.create`）。 */
    window: {
        open: openPluginWindow,
        close: closePluginWindow,
        show: showPluginWindow,
        setBounds: setPluginWindowBounds,
    },
    /** 插件私有存储（`plugins/<id>/data/`，默认允许）。 */
    storage: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
        list: storageList,
        clear: storageClear,
    },
    /** 界面提示。 */
    ui: {
        showNotification,
        /** `showNotification` 的别名，语义一致。 */
        toast: showNotification,
        /** 主面板子输入框（T7-1；对应旧 `setSubInput` 系列）。 */
        setSubInput,
        removeSubInput,
        setSubInputValue,
        subInputFocus,
        subInputSelect,
        subInputBlur,
        onSubInputChange,
        /** 请求主面板内容区高度（T7-1；对应旧 `setExpendHeight`）。 */
        setHeight,
        /** 把当前插件视图分离到独立窗口（T7-11；对应旧"分离到独立窗口"）。 */
        detach: detachUI,
        /** 打开本插件 webview 的开发者工具（T7-12；仅开发模式可用）。 */
        devtools: devtoolsUI,
        /** 弹原生右键菜单（取消返回 `null`；见 {@link contextMenu}）。 */
        contextMenu,
    },
    /** 事件订阅。 */
    events: {
        on: subscribe,
    },
    /** 动态功能管理（需 `features.manage`）。 */
    features: {
        list: featuresList,
        set: featuresSet,
        remove: featuresRemove,
    },
    /** 系统对话框（需 `dialog.open`，T7-2）。 */
    dialog: {
        openFile,
        saveFile,
        showMessage,
    },
    /** 文件相关（T7-2：WebView2 拿不到 `File` 的真实路径，见 {@link getPathForFile}）。 */
    files: {
        getPathForFile,
        /** 本插件的缓存目录（T7-13；可清理，对本插件隐式可读写）。 */
        cacheDir,
    },
    /** Shell（需 `shell.openExternal`，T7-3）。 */
    shell: {
        openExternal,
        openPath,
        showItemInFolder,
        trash: trashItem,
        beep,
    },
    /** 受限 HTTP（需 `network`，T7-4；宿主侧发起，CSP 不放宽）。 */
    http: {
        request: httpRequest,
    },
    /** 键鼠模拟（需 `input.simulate`，T7-5；事件只投给当前前台窗口）。 */
    input: {
        key: inputKey,
        type: inputType,
        mouse: inputMouse,
    },
    /** 任意路径读写（T7-6；只允许用户经系统对话框授权过的范围）。 */
    fs: {
        readText: fsReadText,
        writeText: fsWriteText,
        list: fsList,
    },
    /** 退出当前插件。 */
    exit: exitPlugin,
};
/** "还没有处理器时收到"的事件最多暂存多少条（按 kind）。 */
const LIFECYCLE_MISSED_LIMIT = 16;
/** SDK 侧的按 kind 订阅表。 */
const lifecycleListeners = [];
/** 还没有任何处理器时收到的事件（按 kind 暂存，注册时补投一次）。 */
const missedLifecycle = new Map();
/** SDK 的生命周期分发器是否已经接到宿主桥上。 */
let lifecycleAttached = false;
/**
 * 把 SDK 的生命周期分发器接到宿主桥上（幂等）。
 *
 * 为什么不能只靠 bridge 的排队：bridge 会把"当时还没有处理器"的事件排队，并在**第一个**
 * 处理器注册时一次性分发。分离窗口的 `detach` 正是在页面很早期投递的——等插件在
 * `bootstrap()` 里注册 `onPluginDetach` 时，它已经被"分发过一次"（交给当时唯一存在的
 * `onEnter` 处理器，随后被按 kind 过滤掉）并丢掉了。
 *
 * SDK 因此自己先接住全部事件（模块加载即接线），把"还没有处理器"的事件按 kind 暂存，
 * 在第一个同类处理器注册时补投——每个 kind 只补投一次，不会给后来的处理器重放历史。
 *
 * @returns 无返回值。
 */
function ensureLifecycleDispatcher() {
    if (lifecycleAttached) {
        return;
    }
    lifecycleAttached = true;
    requireBridge().onLifecycle((event) => {
        let delivered = false;
        for (const listener of [...lifecycleListeners]) {
            if (listener.kind === event.kind) {
                listener.handler(event);
                delivered = true;
            }
        }
        if (delivered) {
            return;
        }
        // 没有处理器接的事件先暂存（`detach` / 首个 `enter` 都属于这一类）。
        const pending = missedLifecycle.get(event.kind) ?? [];
        pending.push(event);
        if (pending.length > LIFECYCLE_MISSED_LIMIT) {
            pending.shift();
        }
        missedLifecycle.set(event.kind, pending);
    });
}
// 模块加载即接线：不在插件窗口（没有注入桥）时静默跳过，真正调用能力时仍会抛 `Unsupported`。
try {
    ensureLifecycleDispatcher();
}
catch {
    // 非插件窗口导入 SDK（例如只取类型）：忽略。
}
/**
 * 订阅生命周期事件。
 *
 * 注册时会先补投"注册之前宿主已经投递、但当时还没有同类处理器"的事件（每个 kind 只补投
 * 给第一个注册的处理器），之后走实时分发。
 *
 * @param kind 事件类型。
 * @param handler 处理器。
 * @returns 取消订阅函数。
 */
function onLifecycle(kind, handler) {
    ensureLifecycleDispatcher();
    // 先补投：分离窗口的 `detach`（以及页面首帧的 `enter`）可能早于本处理器注册。
    const missed = missedLifecycle.get(kind);
    if (missed) {
        missedLifecycle.delete(kind);
        for (const event of missed) {
            try {
                handler(event);
            }
            catch (error) {
                console.error('[ztools] 生命周期回调抛错：', error);
            }
        }
    }
    const listener = { kind, handler };
    lifecycleListeners.push(listener);
    return () => {
        const index = lifecycleListeners.indexOf(listener);
        if (index >= 0) {
            lifecycleListeners.splice(index, 1);
        }
    };
}
/**
 * 订阅 `onEnter`。
 *
 * `event.payload` 由被命中的命令类型决定（`07 §6` / T7-9）：
 * - `over` / `regex` → 输入框文本；
 * - `files` → 拖入的文件列表（`MatchedFile[]`，真实路径由宿主给出）；
 * - 其它 / 无上下文 → `null`。
 *
 * @param handler 处理器（收到 `featureCode` 与 `payload`）。
 * @returns 取消订阅函数。
 */
export function onEnter(handler) {
    return onLifecycle('enter', handler);
}
/**
 * 订阅 `onExit`。
 * @param handler 处理器。
 * @returns 取消订阅函数。
 */
export function onExit(handler) {
    return onLifecycle('exit', handler);
}
/**
 * 订阅 `onBackground`（宿主隐藏主面板 + 插件视图时投递，页面保活）。
 *
 * 同一"前台周期"内只投递一次：宿主再次隐藏不会重复触发，
 * 重新唤出不会投递对应的"回到前台"事件（插件视图原样恢复）。
 * @param handler 处理器。
 * @returns 取消订阅函数。
 */
export function onBackground(handler) {
    return onLifecycle('background', handler);
}
/**
 * 订阅 `onDisable`（插件被禁用时投递，投递后宿主销毁插件视图）。
 *
 * 与 `onExit` 的区别：`exit` 是"用户离开"，页面按设计保活以便下次快速进入；
 * `disabled` 是"能力被收回"，宿主会把插件页导航到空白页并清空加载状态，
 * 重新启用后必须重新加载。适合在这里停止轮询/释放资源。
 * @param handler 处理器。
 * @returns 取消订阅函数。
 */
export function onDisable(handler) {
    return onLifecycle('disabled', handler);
}
/**
 * 订阅 `onPluginDetach`（本视图被分离到独立窗口时投递）。
 *
 * 事件在**分离窗口的新页面**里投递，且先于随后的 `onEnter`：
 * `event.featureCode` / `event.payload` 与分离时一致。适合在这里切换布局
 * （例如隐藏"为主面板定制"的边距、显示独立窗口的标题区）。
 *
 * @param handler 处理器。
 * @returns 取消订阅函数。
 */
export function onPluginDetach(handler) {
    return onLifecycle('detach', handler);
}
/**
 * 绑定生命周期处理器（支持设计文档里的 `export default { onEnter }` 写法）。
 * @param plugin 处理器集合。
 * @returns 取消全部订阅的函数。
 */
export function bootstrap(plugin) {
    const disposers = [];
    if (plugin.onEnter) {
        disposers.push(onEnter((event) => void plugin.onEnter?.(event)));
    }
    if (plugin.onExit) {
        disposers.push(onExit((event) => void plugin.onExit?.(event)));
    }
    if (plugin.onBackground) {
        disposers.push(onBackground((event) => void plugin.onBackground?.(event)));
    }
    if (plugin.onDisable) {
        disposers.push(onDisable((event) => void plugin.onDisable?.(event)));
    }
    if (plugin.onPluginDetach) {
        disposers.push(onPluginDetach((event) => void plugin.onPluginDetach?.(event)));
    }
    return () => {
        for (const dispose of disposers) {
            dispose();
        }
    };
}
//# sourceMappingURL=index.js.map