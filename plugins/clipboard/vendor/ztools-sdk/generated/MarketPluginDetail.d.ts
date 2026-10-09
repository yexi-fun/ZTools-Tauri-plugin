import type { MarketPlugin } from "./MarketPlugin.js";
/**
 * 市场上一个插件的详情：元数据 + README。
 */
export type MarketPluginDetail = {
    /**
     * 插件元数据（含本机安装状态）。
     */
    plugin: MarketPlugin;
    /**
     * 服务端 README（`/plugins/readme`；拿不到时为 `None`，不视为错误）。
     */
    readme: string | null;
};
//# sourceMappingURL=MarketPluginDetail.d.ts.map