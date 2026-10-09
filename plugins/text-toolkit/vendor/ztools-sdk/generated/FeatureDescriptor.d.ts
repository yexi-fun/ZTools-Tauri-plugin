import type { PluginCmd } from "./PluginCmd.js";
/**
 * 可被搜索/进入的功能项（宿主前端列表 + `plugin:enter` 的入参来源）。
 */
export type FeatureDescriptor = {
    /**
     * 所属插件 id。
     */
    pluginId: string;
    /**
     * 所属插件展示标题。
     */
    pluginTitle: string;
    /**
     * 功能码。
     */
    code: string;
    /**
     * 展示文本。
     */
    label: string;
    /**
     * 图标：相对插件根的路径或 `plugin://` 绝对地址。
     */
    icon?: string | null;
    /**
     * 命令匹配规则。
     */
    cmds: Array<PluginCmd>;
    /**
     * 是否由插件运行时动态注册（`ztools.features.set`）。
     */
    dynamic: boolean;
};
//# sourceMappingURL=FeatureDescriptor.d.ts.map