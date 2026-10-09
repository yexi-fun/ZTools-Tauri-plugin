/**
 * 市场数据源信息（设置页「插件市场」用来显示"当前从哪儿取插件"）。
 */
export type MarketSourceInfo = {
    /**
     * 源类型：`github`（GitHub 公开仓库）/ `api`（HTTP 市场接口，自建后端或验收 mock）。
     */
    kind: string;
    /**
     * 展示用的源标识：GitHub 是 `owner/repo`，接口模式是基地址。
     */
    label: string;
    /**
     * 清单地址（GitHub 模式是 Release 资产地址；接口模式是 `{base}/plugins`）。
     */
    url: string;
};
//# sourceMappingURL=MarketSourceInfo.d.ts.map