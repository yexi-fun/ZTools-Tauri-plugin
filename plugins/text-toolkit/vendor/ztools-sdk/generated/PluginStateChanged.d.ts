/**
 * 插件运行态变化事件载荷（事件名 `plugin:state-changed`，见 06 §6）。
 */
export type PluginStateChanged = {
    /**
     * 相关插件 id；无插件时为 `None`。
     */
    plugin: string | null;
    /**
     * 状态：`entered` / `exited` / `disabled` / `detached`。
     *
     * `detached` 表示"插件被分离到独立窗口，主面板要回到搜索页"（插件会话仍在，
     * 关闭分离窗口时宿主会重新 `enter` 并再发一次 `entered`）。
     */
    state: string;
    /**
     * 进入插件时带上插件图标（data URL，T7-15）；退出 / 禁用时为 `None`。
     */
    logo?: string | null;
};
//# sourceMappingURL=PluginStateChanged.d.ts.map