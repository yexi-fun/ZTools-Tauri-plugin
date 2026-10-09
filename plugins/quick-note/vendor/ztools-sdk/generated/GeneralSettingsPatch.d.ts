import type { SearchWallpaper } from "./SearchWallpaper.js";
/**
 * 通用设置的部分更新（`None` 表示不改该字段）。
 */
export type GeneralSettingsPatch = {
    /**
     * 主题。
     */
    theme?: string;
    /**
     * 语言。
     */
    language?: string;
    /**
     * 开机自启。
     */
    autoLaunch?: boolean;
    /**
     * 系统通知开关。
     */
    notificationEnabled?: boolean;
    /**
     * 主面板自动粘贴开关。
     */
    autoPasteEnabled?: boolean;
    /**
     * 剪贴板历史开关。
     */
    clipboardEnabled?: boolean;
    /**
     * 历史最大条数。
     */
    clipboardMaxItems?: number;
    /**
     * 历史保留天数。
     */
    clipboardRetentionDays?: number;
    /**
     * 图片采集开关。
     */
    clipboardCaptureImages?: boolean;
    /**
     * 来源应用记录开关。
     */
    clipboardCaptureSource?: boolean;
    /**
     * 粘贴后自动注入 Ctrl+V 的开关。
     */
    clipboardAutoPaste?: boolean;
    /**
     * 悬浮球开关。
     */
    floatingBallEnabled?: boolean;
    /**
     * 鼠标长按开关。
     */
    mouseLongPressEnabled?: boolean;
    /**
     * 鼠标长按按住时长（毫秒）。
     */
    mouseLongPressMs?: number;
    /**
     * 应用搜索开关。
     */
    appSearchEnabled?: boolean;
    /**
     * 主搜索框提示文字。
     */
    searchPlaceholder?: string;
    /**
     * 主搜索框头像的托管图片路径；空字符串表示恢复默认。
     */
    searchAvatar?: string;
    /**
     * 主面板最近使用列表默认显示行数（1..=4）。
     */
    recentRows?: number;
    windowOpacity?: number;
    /**
     * 主题色。
     */
    primaryColor?: string;
    /**
     * 自定义主题色。
     */
    customColor?: string;
    windowMaterial?: string;
    acrylicLightOpacity?: number;
    acrylicDarkOpacity?: number;
    searchWallpaper?: SearchWallpaper | null;
};
//# sourceMappingURL=GeneralSettingsPatch.d.ts.map