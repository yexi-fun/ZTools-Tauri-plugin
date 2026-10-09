import type { PluginCmd } from "./PluginCmd.js";
/**
 * 一条插件功能（旧 `features[]`）。
 */
export type PluginFeature = {
    /**
     * 功能码（进入插件时作为 `featureCode` 传给 `onEnter`）。
     */
    code: string;
    /**
     * 展示文本。
     */
    label: string;
    /**
     * 图标（相对插件根）。
     */
    icon?: string | null;
    /**
     * 命令匹配规则（`over` / `files` / `regex`）。
     */
    cmds?: Array<PluginCmd>;
};
//# sourceMappingURL=PluginFeature.d.ts.map