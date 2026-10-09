import type { SearchWallpaper } from "./SearchWallpaper.js";
/**
 * 通用设置。
 */
export type GeneralSettings = {
    /**
     * 主题：`system` / `light` / `dark`。
     */
    theme: string;
    /**
     * 界面语言：`zh-CN` / `en-US`。
     */
    language: string;
    /**
     * 开机自启（M3 只持久化，注册动作留给 M4 的 autostart 插件）。
     */
    autoLaunch: boolean;
    /**
     * 是否允许弹出系统通知（关掉后仍会弹页面 toast）。
     */
    notificationEnabled: boolean;
    /**
     * 是否在唤出主面板时自动把刚复制的内容填入搜索框（对应 ZTools 的 `autoPaste`）。
     */
    autoPasteEnabled: boolean;
    /**
     * 是否启用剪贴板历史。
     */
    clipboardEnabled: boolean;
    /**
     * 剪贴板历史最大条数。
     */
    clipboardMaxItems: number;
    /**
     * 剪贴板历史保留天数。
     */
    clipboardRetentionDays: number;
    /**
     * 是否采集图片（原始 CF_DIB 字节）。
     */
    clipboardCaptureImages: boolean;
    /**
     * 是否记录来源应用名（M3 暂无 N1 前台窗口信息，保留字段）。
     */
    clipboardCaptureSource: boolean;
    /**
     * 粘贴历史条目时是否自动注入 `Ctrl+V` 粘到前台窗口（关闭则只写回剪贴板）。
     */
    clipboardAutoPaste: boolean;
    /**
     * 是否显示悬浮球（M5，`10 §6`）。
     */
    floatingBallEnabled: boolean;
    /**
     * 是否启用鼠标长按识别（M5，`08 §2` 的 `startMouseMonitor` 等价物）。
     */
    mouseLongPressEnabled: boolean;
    /**
     * 判定长按的按住时长（毫秒）。
     */
    mouseLongPressMs: number;
    /**
     * 是否把本机应用（开始菜单/桌面快捷方式）纳入搜索（M1）。
     */
    appSearchEnabled: boolean;
    /**
     * 主搜索框提示文字。
     */
    searchPlaceholder: string;
    /**
     * 主搜索框头像的托管图片路径；空字符串表示内置头像。
     */
    searchAvatar: string;
    /**
     * 主面板最近使用列表默认显示行数（1..=4）。
     */
    recentRows: number;
    /**
     * 窗口不透明度（0.3..=1）。
     */
    windowOpacity: number;
    /**
     * 主题色：内置颜色名。
     */
    primaryColor: string;
    /**
     * 自定义主题色（#rrggbb）。
     */
    customColor: string;
    /**
     * 窗口材质：none / mica / acrylic。
     */
    windowMaterial: string;
    /**
     * 亚克力亮色背景透明度（0..=100）。
     */
    acrylicLightOpacity: number;
    /**
     * 亚克力暗色背景透明度（0..=100）。
     */
    acrylicDarkOpacity: number;
    /**
     * 主搜索窗口壁纸。
     */
    searchWallpaper: SearchWallpaper | null;
};
//# sourceMappingURL=GeneralSettings.d.ts.map