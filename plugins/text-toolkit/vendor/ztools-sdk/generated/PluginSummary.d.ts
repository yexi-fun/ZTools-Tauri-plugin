/**
 * 宿主前端展示用的插件摘要。
 */
export type PluginSummary = {
    /**
     * 插件 id。
     */
    id: string;
    /**
     * 展示标题。
     */
    title: string;
    /**
     * 版本号。
     */
    version: string;
    /**
     * 是否启用。
     */
    enabled: boolean;
    /**
     * 是否为当前激活（正在插件窗口中运行）的插件。
     */
    active: boolean;
    /**
     * 已声明的权限点。
     */
    permissions: Array<string>;
    /**
     * 已经由用户**显式授权**（T7-7，首次调用弹窗后落盘）的权限点。
     *
     * 设置页「插件」节据此展示"已授权"与"撤销授权"入口。
     */
    grantedPermissions: Array<string>;
    /**
     * 功能数量。
     */
    featureCount: number;
    /**
     * 安装时间（Unix 毫秒）。
     */
    installedAtMs: number;
    /**
     * 安装来源（`.zpx` 路径或 `builtin`）。
     */
    source: string;
    /**
     * 插件图标（`07 §2` 的 `logo` 字段，M7 T7-15）。
     *
     * 宿主把插件目录里的 logo 读成 `data:image/...;base64,...`（见 `plugin_assets.rs`），
     * 直接可放进 `<img src>`；无 logo / 读不到时省略该字段，前端回退默认图标。
     * 只在 `plugin_list`（设置页与主面板的插件信息）里填充，**搜索热路径不读文件**。
     */
    logo?: string | null;
};
//# sourceMappingURL=PluginSummary.d.ts.map