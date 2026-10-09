/**
 * 插件运行时状态（宿主前端与验收脚本用）。
 */
export type PluginRuntimeStatus = {
    /**
     * 当前激活的插件 id；没有激活插件时为 `None`。
     */
    activePlugin: string | null;
    /**
     * 当前插件的开发态入口（dev server）是否生效。
     */
    devMode: boolean;
    /**
     * 插件窗口是否存在。
     */
    windowExists: boolean;
    /**
     * 插件窗口是否可见。
     */
    windowVisible: boolean;
    /**
     * 插件页是否已通过 `plugin_ready` 握手。
     */
    ready: boolean;
    /**
     * 已投递的生命周期事件数。
     */
    lifecycleEvents: number;
    /**
     * 已处理的插件能力调用次数（含被拒）。
     */
    capabilityCalls: number;
};
//# sourceMappingURL=PluginRuntimeStatus.d.ts.map