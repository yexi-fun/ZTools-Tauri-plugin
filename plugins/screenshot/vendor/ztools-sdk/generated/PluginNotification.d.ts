/**
 * 插件发出的通知（`ztools.ui.showNotification` 的宿主载荷）。
 */
export type PluginNotification = {
    /**
     * 来源插件 id。
     */
    pluginId: string;
    /**
     * 通知标题。
     */
    title: string;
    /**
     * 通知正文。
     */
    body?: string | null;
};
//# sourceMappingURL=PluginNotification.d.ts.map