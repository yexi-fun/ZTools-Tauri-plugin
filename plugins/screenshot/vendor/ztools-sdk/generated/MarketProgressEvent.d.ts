/**
 * 市场安装的进度事件（宿主 → 主面板 `plugin:market-progress`）。
 */
export type MarketProgressEvent = {
    /**
     * 插件名称。
     */
    name: string;
    /**
     * 阶段：`download`（流式下载） / `install`（解包安装）。
     */
    stage: string;
    /**
     * 已接收字节（`install` 阶段为 0）。
     */
    received: number;
    /**
     * 总字节（服务端未给 `Content-Length` 时为 0）。
     */
    total: number;
    /**
     * 百分比（0–100；总量未知时按 0 上报）。
     */
    percent: number;
};
//# sourceMappingURL=MarketProgressEvent.d.ts.map