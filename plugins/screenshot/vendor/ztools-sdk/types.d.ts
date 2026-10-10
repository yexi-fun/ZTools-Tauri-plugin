/**
 * 跨边界类型（插件 ↔ 宿主）。
 *
 * 与 Rust `ztools-types` 的 `serde(rename_all = "camelCase")` 结构一一对应。
 * 依据 `迁移计划/06-前后端契约设计.md` §5，最终应由 `ts-rs` 生成；
 * M2 先手写镜像，生成链路（`packages/ztools-shared`）留待契约卡补齐。
 */
/** 统一错误类别（`06 §4` 的 `ApiError`）。 */
export type ApiErrorKind = 'InvalidArgument' | 'NotFound' | 'PermissionDenied' | 'Unsupported' | 'Upstream' | 'Internal';
export type { PluginCmd } from './generated/PluginCmd.js';
export type { PluginFeature } from './generated/PluginFeature.js';
export type { FeatureDescriptor } from './generated/FeatureDescriptor.js';
export type { PluginSummary } from './generated/PluginSummary.js';
export type { StorageEntry } from './generated/StorageEntry.js';
/** 单个命名库条目计数。 */
export interface LegacyDbCounts {
    main: number;
    meta: number;
    attachment: number;
    changelog: number;
    revision: number;
    syncTask: number;
}
/** 一个账号数据空间的导入摘要。 */
export interface LegacyAccountSummary {
    uid: string | null;
    dirName: string;
    isCurrent: boolean;
    relDir: string;
    counts: LegacyDbCounts;
}
/** 导入前预览。 */
export interface LegacyImportPreview {
    exportPath: string;
    format: string;
    formatVersion: number;
    generatedAt: string;
    currentAccountUid: string | null;
    device: LegacyDbCounts;
    accounts: LegacyAccountSummary[];
    attachments: number;
    warnings: string[];
    fingerprint: string;
    alreadyImported: boolean;
    importedFingerprint: string | null;
}
/** 单条导入校验结果。 */
export interface LegacyVerificationItem {
    name: string;
    expected: number;
    actual: number;
    ok: boolean;
}
/** 导入结果报告。 */
export interface LegacyImportReport {
    exportPath: string;
    formatVersion: number;
    generatedAt: string;
    device: LegacyDbCounts;
    accounts: LegacyAccountSummary[];
    attachments: number;
    keysWritten: number;
    settingsMapped: boolean;
    verification: LegacyVerificationItem[];
    verificationOk: boolean;
    warnings: string[];
    fingerprint: string;
    skipped: boolean;
    importedAt: string;
    durationMs: number;
}
/** 导入状态。 */
export interface LegacyImportStatus {
    imported: boolean;
    version: number;
    fingerprint: string | null;
    importedAt: string | null;
    source: string | null;
    keysWritten: number;
}
/** 更新源。 */
export interface UpdateSourceConfig {
    id: string;
    name: string;
    url: string;
    priority: number;
}
/** 更新通道配置。 */
export interface UpdateChannelConfig {
    sources: UpdateSourceConfig[];
    channel: 'stable' | 'beta' | string;
    autoCheck: boolean;
}
/** 单个更新源检查结果。 */
export interface UpdateSourceResult {
    id: string;
    url: string;
    ok: boolean;
    error: string | null;
    version: string | null;
    hasAsset: boolean;
}
/** 更新检查结果。 */
export interface UpdateCheckResult {
    currentVersion: string;
    available: boolean;
    latestVersion: string | null;
    release: {
        version: string;
        notes: string;
        publishedAt: number;
        channel: string | null;
        assets: Array<{
            systemType: string;
            url: string;
            sha256: string | null;
            size: number;
            kind: string | null;
        }>;
    } | null;
    sources: UpdateSourceResult[];
    systemType: string;
    channel: string;
}
/** 下载结果。 */
export interface UpdateDownloadResult {
    version: string;
    path: string;
    byteLength: number;
    sha256: string;
    hashVerified: boolean;
    url: string;
    kind: string | null;
}
/** 安装结果。 */
export interface UpdateInstallResult {
    version: string;
    method: string;
    launched: boolean;
    detail: string;
}
/** 更新器快照。 */
export interface UpdaterSnapshot {
    check: UpdateCheckResult | null;
    download: UpdateDownloadResult | null;
    install: UpdateInstallResult | null;
    currentVersion: string;
    config: UpdateChannelConfig;
}
/** 更新进度。 */
export interface UpdateProgress {
    phase: string;
    version: string;
    downloaded: number;
    total: number;
    percent: number;
    url: string | null;
    error: string | null;
}
/** HTTP 服务配置。 */
export interface HttpServerConfig {
    enabled: boolean;
    port: number;
    apiKey: string;
}
/** HTTP 服务状态。 */
export interface HttpServerStatus {
    running: boolean;
    enabled: boolean;
    port: number;
    apiKey: string;
    baseUrl: string;
    requestCount: number;
    lastError: string | null;
}
/** 系统信息。 */
export interface SystemInfo {
    os: string;
    arch: string;
    appVersion: string;
    dataRoot: string;
    storePath: string;
    pluginDir: string;
    legacyLmdbDetected: boolean;
    legacyImported: boolean;
    ffmpegPresent: boolean;
    ffmpegPath: string | null;
    httpServerRunning: boolean;
}
/** ffmpeg 状态。 */
export interface FfmpegStatus {
    present: boolean;
    dir: string;
    executable: string | null;
    downloadedBytes: number;
}
/** ffmpeg 进度。 */
export interface FfmpegProgress {
    phase: string;
    downloaded: number;
    total: number;
    percent: number;
    error: string | null;
}
/** 生命周期事件（`onEnter` / `onExit` / `onBackground` / `onDisable` / `onPluginDetach`）。 */
export interface PluginLifecycleEvent {
    /**
     * 事件类型：
     * - `enter`：进入功能（宿主创建/复用插件页并投递 `featureCode` + `payload`）；
     * - `exit`：用户退出插件（`onExit`）；
     * - `background`：宿主隐藏（主面板 + 插件视图），页面保活（`onBackground`）；
     * - `disabled`：插件被禁用，视图随后被销毁（`onDisable`，T7-10）。
     * - `detach`：本视图被分离到独立窗口（`onPluginDetach`，T7-11；随后还会收到 `enter`）。
     */
    kind: 'enter' | 'exit' | 'background' | 'disabled' | 'detach' | string;
    /** 插件 id。 */
    pluginId: string;
    /** `enter` 时的功能码。 */
    featureCode?: string;
    /**
     * `enter` 时的透传载荷（`07 §6` / T7-9）。
     *
     * 语义由被命中的 `cmds[].type` 决定：
     * - `over` / `regex` → 输入框文本（`string`）；
     * - `files` → 拖入的文件列表（{@link MatchedFile}[]）；
     * - 其它 / 没有上下文 → `null`。
     */
    payload?: unknown;
}
/**
 * `files` 指令的 `onEnter` 载荷项（T7-9）。
 *
 * 真实磁盘路径由**宿主**提供（Tauri 原生拖放事件）：WebView2 不向页面暴露 `File` 的
 * 真实路径，因此插件不要试图从 DOM `File` 里取路径（见 `ztools.files.getPathForFile`）。
 */
export interface MatchedFile {
    /** 是否为普通文件（`false` 表示目录）。 */
    isFile: boolean;
    /** 是否为目录。 */
    isDirectory: boolean;
    /** 文件名（含扩展名）。 */
    name: string;
    /** 绝对路径。 */
    path: string;
}
export type { DroppedFile } from './generated/DroppedFile.js';
export type { PluginRuntimeStatus } from './generated/PluginRuntimeStatus.js';
export type { PluginNotification } from './generated/PluginNotification.js';
export type { PluginStateChanged } from './generated/PluginStateChanged.js';
/** 通知入参（`ztools.ui.showNotification`）。 */
export interface NotificationInput {
    /** 标题。 */
    title: string;
    /** 正文。 */
    body?: string;
}
import type { GeneralSettings } from './generated/GeneralSettings.js';
export type { GeneralSettings } from './generated/GeneralSettings.js';
export type { GeneralSettingsPatch } from './generated/GeneralSettingsPatch.js';
export type { SearchWallpaper as SearchWallpaperConfig } from './generated/SearchWallpaper.js';
/** 快捷键设置（`ZTOOLS/global-shortcuts`）。 */
export interface ShortcutSettings {
    /** 是否启用双击修饰键唤起。 */
    doubleTapEnabled: boolean;
    /** 双击目标键：Ctrl / Shift / Alt / Win。 */
    doubleTapKey: string;
    /** 主面板快捷键。 */
    togglePanel: string;
    /** 超级面板快捷键。 */
    toggleSuperPanel: string;
    /** 剪贴板历史窗口快捷键（内置插件 `top.z-tools.clipboard`）。 */
    toggleClipboard: string;
    /** 自定义全局快捷键（设置页「快捷键 → 全局快捷键」）。 */
    custom: GlobalShortcut[];
}
/** 快捷键设置的部分更新。 */
export interface ShortcutSettingsPatch {
    /** 双击开关。 */
    doubleTapEnabled?: boolean;
    /** 双击目标键。 */
    doubleTapKey?: string;
    /** 主面板快捷键。 */
    togglePanel?: string;
    /** 超级面板快捷键。 */
    toggleSuperPanel?: string;
    /** 剪贴板历史窗口快捷键。 */
    toggleClipboard?: string;
    /** 自定义全局快捷键（整表替换）。 */
    custom?: GlobalShortcut[];
}
/**
 * 一条自定义全局快捷键（对应 ZTools 的同名能力）。
 *
 * `target` 只支持两类可执行目标：`system:<动作>`（宿主内置动作）与
 * `plugin:<插件 id>#<功能码>`（插件功能）。
 */
export interface GlobalShortcut {
    /** 稳定 id（前端生成，编辑 / 删除按它定位）。 */
    id: string;
    /** 键位文本（如 `Ctrl+Alt+1`），写法与内置快捷键一致。 */
    shortcut: string;
    /** 目标：`system:<动作>` 或 `plugin:<插件 id>#<功能码>`。 */
    target: string;
    /** 目标显示名（列表直接展示）。 */
    label: string;
    /** 是否启用；停用后不注册但保留在列表里。 */
    enabled: boolean;
}
/** 一条自定义全局快捷键 + 本次注册结果。 */
export interface GlobalShortcutState {
    /** 快捷键配置。 */
    item: GlobalShortcut;
    /** 是否注册成功。 */
    registered: boolean;
    /** 未注册原因；空串表示正常（含"已停用"）。 */
    error: string;
}
/** 设置快照。 */
export interface SettingsSnapshot {
    /** 通用设置。 */
    general: GeneralSettings;
    /** 快捷键设置。 */
    shortcuts: ShortcutSettings;
}
/** 快捷键生效状态。 */
export interface ShortcutStatus {
    /** 双击是否启用。 */
    doubleTapEnabled: boolean;
    /** 双击目标键（展示名）。 */
    doubleTapKey: string;
    /** 双击目标虚拟键码。 */
    doubleTapVk: number;
    /** 低层钩子是否安装成功。 */
    hookInstalled: boolean;
    /** 主面板快捷键。 */
    togglePanel: string;
    /** 主面板快捷键是否注册成功。 */
    togglePanelRegistered: boolean;
    /** 超级面板快捷键。 */
    toggleSuperPanel: string;
    /** 超级面板快捷键是否注册成功。 */
    toggleSuperPanelRegistered: boolean;
    /** 剪贴板历史窗口快捷键。 */
    toggleClipboard: string;
    /** 剪贴板历史窗口快捷键是否注册成功。 */
    toggleClipboardRegistered: boolean;
}
/** 路径与版本信息。 */
export interface AppPathsInfo {
    /** 数据根。 */
    dataRoot: string;
    /** 新文档库路径。 */
    storePath: string;
    /** 插件目录。 */
    pluginDir: string;
    /** 剪贴板图片目录。 */
    clipboardImageDir: string;
    /** 是否检测到旧版 LMDB（M4 才导入）。 */
    legacyLmdbDetected: boolean;
    /** 宿主版本。 */
    appVersion: string;
}
/** 一条剪贴板历史。 */
export interface ClipboardItem {
    /** 条目 id。 */
    id: string;
    /** 类型：text / image。 */
    kind: string;
    /** 记录时间（Unix 毫秒）。 */
    timestampMs: number;
    /** 内容哈希。 */
    hash: string;
    /** 列表预览。 */
    preview: string;
    /** 文本内容。 */
    text?: string | null;
    /** 图片路径。 */
    imagePath?: string | null;
    /** 分辨率。 */
    resolution?: string | null;
    /** 字节数。 */
    sizeBytes?: number | null;
    /** 来源应用（M3 未采集）。 */
    source?: string | null;
}
/** 剪贴板监视与历史状态。 */
export interface ClipboardStatus {
    /** 是否启用。 */
    enabled: boolean;
    /** 是否采集图片。 */
    captureImages: boolean;
    /** 历史条数。 */
    items: number;
    /** 图片文件数。 */
    imageFiles: number;
    /** 图片总字节数。 */
    imageBytes: number;
    /** 最近一次序列号。 */
    sequence: number;
    /** 自启动以来捕获数。 */
    captured: number;
    /** 文档库路径。 */
    storePath: string;
    /** 图片目录。 */
    imageDir: string;
}
/** 一条搜索结果。 */
export interface SearchResult {
    /** 结果 id。 */
    id: string;
    /** 类型：system / feature / clipboard。 */
    kind: string;
    /** 标题。 */
    title: string;
    /** 副标题。 */
    subtitle: string;
    /** 执行码。 */
    code: string;
    /** 所属插件 id。 */
    pluginId?: string | null;
    /** 匹配得分。 */
    score: number;
    /** 透传载荷。 */
    payload?: unknown;
    /** 图标（`data:image/png;base64,...`；应用结果按需填充）。 */
    icon?: string | null;
}
/** 搜索请求。 */
export interface SearchRequest {
    /** 查询文本。 */
    query: string;
    /** 当前文件（`files` 类型命令匹配用）。 */
    files?: string[];
    /** 返回上限。 */
    limit?: number;
}
/** 超级面板固定项。 */
export interface PinnedCommand {
    /** 稳定 id。 */
    id: string;
    /** 类型：system / feature / clipboard。 */
    kind: string;
    /** 执行码。 */
    code: string;
    /** 展示文本。 */
    label: string;
    /** 所属插件 id。 */
    pluginId?: string | null;
    /** 图标。 */
    icon?: string | null;
}
/** 固定项集合。 */
export interface PinnedCommands {
    /** 固定项列表。 */
    items: PinnedCommand[];
}
/** 通知请求。 */
export interface NotificationRequest {
    /** 标题。 */
    title: string;
    /** 正文。 */
    body?: string;
    /** 来源。 */
    source?: string;
    /** 是否允许系统通知（缺省跟随设置）。 */
    system?: boolean;
}
/** 通知结果。 */
export interface NotificationOutcome {
    /** 是否弹出系统通知。 */
    system: boolean;
    /** 是否广播 toast。 */
    toast: boolean;
    /** 系统通知失败原因。 */
    systemError?: string | null;
}
/** 一次全屏截图的结果（`screen_capture` / `screen_capture_fetch`）。 */
export type { ScreenshotCapture } from './generated/ScreenshotCapture.js';
export type { ScreenshotWindow } from './generated/ScreenshotWindow.js';
/** 截图保存/复制结果。 */
export interface ScreenshotResult {
    /** 目标：file / clipboard。 */
    target: string;
    /** 落盘路径（复制到剪贴板时为空）。 */
    path?: string | null;
    /** 位图宽度。 */
    width: number;
    /** 位图高度。 */
    height: number;
    /** 写入的字节数。 */
    byteLength: number;
}
/**
 * 插件自建窗口的创建参数（`ztools.window.open` 的 `options`，全部可选）。
 *
 * 位置与尺寸按**物理像素**下发（多屏时用它把窗口盖满虚拟屏幕）。
 */
export interface PluginWindowOptions {
    /** 窗口标题。 */
    title?: string;
    /** 物理像素 X（虚拟屏幕坐标，多屏时可能为负）。 */
    x?: number;
    /** 物理像素 Y。 */
    y?: number;
    /** 物理像素宽。 */
    width?: number;
    /** 物理像素高。 */
    height?: number;
    /** 是否无边框（默认 `true`）。 */
    decorations?: boolean;
    /** 是否透明（默认 `false`）。 */
    transparent?: boolean;
    /** 是否置顶（默认 `true`）。 */
    alwaysOnTop?: boolean;
    /** 是否可缩放（默认 `false`）。 */
    resizable?: boolean;
    /** 是否跳过任务栏（默认 `true`）。 */
    skipTaskbar?: boolean;
    /** 显示后是否抢焦点（默认 `true`）。 */
    focus?: boolean;
    /**
     * 是否**不随会话结束关闭**（默认 `false`）。
     *
     * 截图插件的"钉在桌面"贴图窗口用它：会话 `exit` 之后窗口留在桌面上，直到用户关掉它；
     * 插件被禁用 / 卸载时仍会一起关闭。
     */
    persistent?: boolean;
    /**
     * 建窗后是否**立即显示**（默认 `true`）。
     *
     * 传 `false` 时窗口建好但保持隐藏，由插件页在画面准备好后调用
     * `ztools.window.show()` 显示 —— 用于消掉"全屏窗口先白屏、再画出内容"的闪屏。
     * 插件页超过 5s 仍未显示时，宿主会兜底显示它。
     */
    visible?: boolean;
}
/**
 * 原生右键菜单的一项（`ztools.ui.contextMenu` 的参数）。
 */
export interface ContextMenuItem {
    /** 项 id：选中后原样返回（用来区分点了哪一项）。 */
    id: string;
    /** 显示文本。 */
    label: string;
    /** 是否在这一项**之前**插一条分隔线（第一项忽略）。 */
    separatorBefore?: boolean;
}
/**
 * 插件自建窗口的**客户区**矩形（`ztools.window.setBounds` 的参数与返回值）。
 *
 * 单位是**物理像素**：`x` / `y` 是客户区左上角的屏幕坐标，`width` / `height` 是客户区尺寸。
 * 宿主会把无边框窗口的隐形边框与 DPI 折算的偏差补掉，因此这里的值就是画布实际占的矩形。
 */
export interface PluginWindowBounds {
    /** 目标窗口 label；省略表示**调用方自己所在的窗口**。 */
    label?: string;
    /** 客户区左上角的屏幕 X（物理像素）。 */
    x?: number;
    /** 客户区左上角的屏幕 Y（物理像素）。 */
    y?: number;
    /** 客户区宽度（物理像素）。 */
    width?: number;
    /** 客户区高度（物理像素）。 */
    height?: number;
}
/**
 * 子输入框状态补丁（`plugin_ui_sub_input` 的参数，字段全部可选）。
 *
 * 宿主把它合并进"当前子输入框状态"，因此每次调用只需要带上要改的字段：
 * 显示/隐藏、占位符、值、一次性焦点意图。
 */
export interface SubInputPatch {
    /** 占位提示（空串会让主面板回退到默认文案）。 */
    placeholder?: string;
    /** 是否显示子输入框。 */
    visible?: boolean;
    /** 由插件写入的值（`setSubInputValue`）。 */
    value?: string;
    /** 一次性焦点意图：`true` 聚焦，`false` 失焦（`subInputBlur`）。 */
    focus?: boolean;
    /** 一次性意图：聚焦并全选（优先级高于 `focus`）。 */
    select?: boolean;
}
/**
 * `ztools.ui.setSubInput` 的参数。
 *
 * 对应旧 `setSubInput(onChange, placeholder, isFocus)`：回调改由
 * {@link SubInputChangeHandler} 通过 `onSubInputChange` 单独注册。
 */
export interface SubInputOptions {
    /** 占位提示。 */
    placeholder?: string;
    /** 是否立即聚焦（默认 `true`）。 */
    isFocus?: boolean;
    /** 是否聚焦并全选（默认 `false`）。 */
    isSelect?: boolean;
}
/**
 * 子输入框内容变化处理器。
 * @param value 用户在子输入框里输入（或宿主回传）的文本。
 * @returns 无返回值。
 */
export type SubInputChangeHandler = (value: string) => void;
/** 文件对话框的类型过滤器（`extensions` 只写扩展名本身，如 `txt`）。 */
export interface DialogFilter {
    /** 展示名（如 `文本文件`）。 */
    name: string;
    /** 扩展名列表。 */
    extensions: string[];
}
/**
 * `ztools.dialog.openFile` / `saveFile` 的参数。
 *
 * `defaultPath` 可以是目录、目录 + 文件名，或单个文件名（宿主会拆开传给系统对话框）。
 */
export interface DialogFileOptions {
    /** 对话框标题。 */
    title?: string;
    /** 默认路径。 */
    defaultPath?: string;
    /** 类型过滤器。 */
    filters?: DialogFilter[];
    /** `openFile` 专用：选择**目录**而不是文件（为真时忽略过滤器）。 */
    directory?: boolean;
}
/** `ztools.dialog.showMessage` 的参数（也可以直接传一个字符串当正文）。 */
export interface DialogMessageOptions {
    /** 标题。 */
    title?: string;
    /** 正文（不能为空）。 */
    message: string;
    /** 图标/语气，默认 `info`。 */
    kind?: 'info' | 'warning' | 'error';
}
/** 目录项（`ztools.fs.list` 的返回值，T7-6）。 */
export interface FsEntry {
    /** 名称（不含路径）。 */
    name: string;
    /** 完整路径。 */
    path: string;
    /** 是否是目录。 */
    isDirectory: boolean;
    /** 文件大小（字节）；目录恒为 0。 */
    size: number;
}
/** 键盘动作（`ztools.input.key`）。 */
export type InputKeyAction = 'tap' | 'down' | 'up';
/** 鼠标按键（`ztools.input.mouse`）。 */
export type InputMouseButton = 'left' | 'right' | 'middle';
/**
 * `ztools.input.mouse` 的参数。
 *
 * 坐标是**物理像素**的屏幕坐标（多屏时虚拟桌面坐标系，可能为负）；
 * `move` / `click` / `down` 必须给坐标，`up` / `scroll` 不需要。
 */
export interface InputMouseOptions {
    /** 动作：移动 / 单击（`clicks` 可为 2 做双击）/ 按下 / 抬起 / 滚轮。 */
    action: 'move' | 'click' | 'down' | 'up' | 'scroll';
    /** 目标 X（物理像素）。 */
    x?: number;
    /** 目标 Y（物理像素）。 */
    y?: number;
    /** 按键，默认 `left`。 */
    button?: InputMouseButton;
    /** `click` 的连击次数（1 或 2，默认 1）。 */
    clicks?: 1 | 2;
    /** `scroll` 的水平滚动量（`WHEEL_DELTA` 的整数倍）。 */
    deltaX?: number;
    /** `scroll` 的垂直滚动量（向下为正）。 */
    deltaY?: number;
}
/**
 * `ztools.http.request` 的参数。
 *
 * 请求由宿主侧发出（插件页不直连，CSP 不放宽）；宿主侧策略无法被请求参数放宽：
 * 只允许 `http`/`https`，默认拦截本机/私网，响应超过宿主上限会直接报错。
 */
export interface HttpRequestOptions {
    /** 目标 URL（只允许 `http` / `https`）。 */
    url: string;
    /** HTTP 方法，缺省 `GET`；只放行 GET/POST/PUT/PATCH/DELETE。 */
    method?: string;
    /** 请求头（拒绝控制字符，数量与长度有上限）。 */
    headers?: Record<string, string>;
    /** 请求体（文本，上限 256 KiB）。 */
    body?: string;
    /** 单次超时（毫秒）：只能比宿主上限更小，越小越早失败。 */
    timeoutMs?: number;
}
/** `ztools.http.request` 的响应。 */
export interface HttpResponse {
    /** HTTP 状态码（3xx 不会自动跟随，原样返回）。 */
    status: number;
    /** 响应头（同名头合并）。 */
    headers: Record<string, string>;
    /** 响应体（UTF-8 有损解码）。 */
    body: string;
    /** 实际请求的 URL。 */
    url: string;
    /** 响应体字节数。 */
    size: number;
}
/** UI Automation / 剪贴板回退取到的选中内容。 */
export interface SelectedContent {
    /** 选中文本。 */
    text: string;
    /** 来源：uia / clipboard。 */
    source: string;
    /** 来源应用名。 */
    appName?: string | null;
    /** 来源窗口标题。 */
    windowTitle?: string | null;
    /** 取词耗时（毫秒）。 */
    elapsedMs: number;
}
/** 一个 Explorer 文件窗口。 */
export interface ExplorerWindow {
    /** 窗口句柄。 */
    hwnd: number;
    /** 窗口标题。 */
    title: string;
    /** 当前文件夹路径。 */
    path?: string | null;
    /** 是否为文件位置窗口。 */
    isFileLocationWindow: boolean;
    /** 是否为前台窗口。 */
    active: boolean;
}
/** 一个浏览器窗口。 */
export interface BrowserWindow {
    /** 窗口句柄。 */
    hwnd: number;
    /** 窗口标题。 */
    title: string;
    /** 进程名。 */
    process: string;
    /** 地址栏 URL。 */
    url?: string | null;
    /** 是否为前台窗口。 */
    active: boolean;
}
/** 地址栏写入结果。 */
export interface AddressBarResult {
    /** 目标窗口句柄。 */
    hwnd: number;
    /** 写入的值。 */
    value: string;
    /** 实现路径（当前为 uia）。 */
    method: string;
    /** 是否已按回车跳转。 */
    navigated: boolean;
}
/** 鼠标长按监听状态。 */
export interface MouseHookStatus {
    /** 钩子是否安装成功。 */
    installed: boolean;
    /** 安装钩子的线程 ID。 */
    threadId: number;
    /** 是否启用长按识别。 */
    longPressEnabled: boolean;
    /** 按住时长阈值（毫秒）。 */
    holdMs: number;
    /** 允许的最大位移（物理像素）。 */
    moveTolerance: number;
    /** 回调总次数。 */
    callbacks: number;
    /** 按下次数。 */
    buttonDowns: number;
    /** 识别出的长按次数。 */
    longPresses: number;
    /** 其中带注入标记（合成输入）的按下次数。 */
    injectedEvents: number;
    /** 最近一次长按距今毫秒数。 */
    lastLongPressMsAgo: number;
    /** 备注。 */
    note: string;
}
/** 一次鼠标长按事件（`mouse:long-press`）。 */
export interface MouseLongPress {
    /** 按键：left / right / middle。 */
    button: string;
    /** 松开时 X（物理像素）。 */
    x: number;
    /** 松开时 Y（物理像素）。 */
    y: number;
    /** 按住时长（毫秒）。 */
    durationMs: number;
    /** 前台窗口句柄。 */
    hwnd: number;
    /** 前台窗口标题。 */
    windowTitle: string;
}
/** 悬浮球设置。 */
export interface FloatingBallSettings {
    /** 是否显示。 */
    enabled: boolean;
    /** 左上角 X（逻辑像素）。 */
    x?: number | null;
    /** 左上角 Y（逻辑像素）。 */
    y?: number | null;
    /** 直径（逻辑像素）。 */
    size: number;
    /** 不透明度。 */
    opacity: number;
}
/** 悬浮球设置的部分更新。 */
export interface FloatingBallPatch {
    /** 是否显示。 */
    enabled?: boolean;
    /** 左上角 X。 */
    x?: number;
    /** 左上角 Y。 */
    y?: number;
    /** 直径。 */
    size?: number;
    /** 不透明度。 */
    opacity?: number;
}
/** 悬浮球运行状态。 */
export interface FloatingBallState {
    /** 设置中的开关。 */
    enabled: boolean;
    /** 窗口是否存在。 */
    windowExists: boolean;
    /** 窗口是否可见。 */
    visible: boolean;
    /** 左上角 X（物理像素）。 */
    x: number;
    /** 左上角 Y（物理像素）。 */
    y: number;
    /** 直径（物理像素）。 */
    size: number;
    /** 设置里的直径（逻辑像素）。 */
    sizeLogical: number;
    /** 不透明度。 */
    opacity: number;
}
/** 应用索引里的一条应用。 */
export interface AppEntry {
    /** 稳定 id。 */
    id: string;
    /** 展示名。 */
    name: string;
    /** 类型：shortcut / uwp。 */
    kind: string;
    /** 启动参数（.lnk 路径或 `shell:AppsFolder\...`）。 */
    launch: string;
    /** 快捷方式目标程序。 */
    target?: string | null;
    /** 快捷方式参数。 */
    arguments?: string | null;
    /** 工作目录。 */
    workingDir?: string | null;
    /** 来源：start-menu / common-start-menu / desktop / custom。 */
    source: string;
    /** 快捷方式文件路径。 */
    shortcutPath: string;
    /** 图标 data URL（按需填充）。 */
    icon?: string | null;
}
/** 应用索引里某个来源的条目数。 */
export interface AppSourceCount {
    /** 来源名。 */
    source: string;
    /** 条目数。 */
    count: number;
}
/** 应用索引状态。 */
export interface AppIndexStatus {
    /** 应用搜索是否启用。 */
    enabled: boolean;
    /** 索引条目数。 */
    count: number;
    /** UWP 条目数。 */
    uwpCount: number;
    /** 最近一次扫描时刻（Unix 毫秒）。 */
    scannedAtMs: number;
    /** 最近一次扫描耗时（毫秒）。 */
    scanMs: number;
    /** 各来源条目数。 */
    sources: AppSourceCount[];
    /** 图标缓存目录。 */
    iconCacheDir: string;
    /** 额外扫描目录。 */
    extraDirs: string[];
    /** 最近一次扫描的错误。 */
    lastError?: string | null;
}
export type { MarketPlugin } from './generated/MarketPlugin.js';
export type { MarketPluginDetail } from './generated/MarketPluginDetail.js';
export type { MarketReleaseItem } from './generated/MarketReleaseItem.js';
export type { MarketReleases } from './generated/MarketReleases.js';
export type { MarketProgressEvent } from './generated/MarketProgressEvent.js';
export type { MarketSourceInfo } from './generated/MarketSourceInfo.js';
//# sourceMappingURL=types.d.ts.map