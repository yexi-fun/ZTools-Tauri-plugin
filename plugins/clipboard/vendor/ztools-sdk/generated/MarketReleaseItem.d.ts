/**
 * 市场版本历史里的一条发布记录（`/plugins/releases`）。
 */
export type MarketReleaseItem = {
    /**
     * 版本号。
     */
    version: string;
    /**
     * 更新日志（服务端字段名是 `releaseNotes`）。
     */
    releaseNotes: string | null;
    /**
     * 发布时间（Unix 毫秒）。
     */
    publishedAt: number | null;
    /**
     * 开源 / 闭源标记。
     */
    sourceType: string | null;
};
//# sourceMappingURL=MarketReleaseItem.d.ts.map