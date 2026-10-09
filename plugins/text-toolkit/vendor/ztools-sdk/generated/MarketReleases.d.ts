import type { MarketReleaseItem } from "./MarketReleaseItem.js";
/**
 * 市场版本历史（`/plugins/releases`）。
 */
export type MarketReleases = {
    /**
     * 插件名称。
     */
    name: string;
    /**
     * 市场当前最新版本。
     */
    currentVersion: string;
    /**
     * 版本列表（新→旧）。
     */
    items: Array<MarketReleaseItem>;
};
//# sourceMappingURL=MarketReleases.d.ts.map