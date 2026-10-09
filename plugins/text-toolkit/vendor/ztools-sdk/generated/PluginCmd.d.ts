/**
 * 命令匹配规则（语义与旧实现一致，见 `07 §6`）。
 */
export type PluginCmd = {
    /**
     * 匹配类型：`over` / `files` / `regex`。
     */
    type: 'over' | 'files' | 'regex' | string;
    /**
     * 展示文本。
     */
    label?: string | null;
    /**
     * `over` 类型的最小长度。
     */
    minLength?: number | null;
    /**
     * `over` 类型的最大长度。
     */
    maxLength?: number | null;
    /**
     * `files` 类型的条目类型（`file` / `directory` / …）。
     */
    fileType?: string | null;
    /**
     * `files` / `regex` 的匹配表达式。
     */
    match?: string | null;
};
//# sourceMappingURL=PluginCmd.d.ts.map