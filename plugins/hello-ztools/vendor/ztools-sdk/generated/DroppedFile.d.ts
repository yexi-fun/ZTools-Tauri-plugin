/**
 * 拖入主面板的一个文件/目录（宿主 → 前端，T7-9）。
 *
 * WebView2 不向页面暴露 `File` 的真实磁盘路径（见 T7-2 的结论），因此"拖入文件"
 * 由**宿主**接住 Tauri 的原生拖放事件（`WindowEvent::DragDrop`），把真实路径列表
 * 推给主面板；主面板再据此构造插件 `onEnter` 的 `files` 载荷。
 */
export type DroppedFile = {
    /**
     * 绝对路径。
     */
    path: string;
    /**
     * 文件名（含扩展名；目录为末级目录名）。
     */
    name: string;
    /**
     * 是否目录。
     */
    isDirectory: boolean;
};
//# sourceMappingURL=DroppedFile.d.ts.map