import type { ScreenshotWindow } from "./ScreenshotWindow.js";
/**
 * 一次全屏截图的结果。
 *
 * `data_url` 是 `data:image/png;base64,...`，选区窗口直接用作 `<img src>`；
 * 宽高与原点都是**物理像素**，`scale_factor` 用于把物理像素折算成窗口逻辑像素。
 */
export type ScreenshotCapture = {
    /**
     * 位图宽度（物理像素）。
     */
    width: number;
    /**
     * 位图高度（物理像素）。
     */
    height: number;
    /**
     * 虚拟屏幕左上角 X（物理像素，多屏时可能为负）。
     */
    originX: number;
    /**
     * 虚拟屏幕左上角 Y（物理像素）。
     */
    originY: number;
    /**
     * 选区窗口所在显示器的缩放比（1.0 = 100%）。
     */
    scaleFactor: number;
    /**
     * 参与合成的显示器数量。
     */
    monitorCount: number;
    /**
     * PNG 字节数。
     */
    byteLength: number;
    /**
     * 捕获时刻（Unix 毫秒）。
     */
    capturedAtMs: number;
    /**
     * PNG 的 data URL。
     */
    dataUrl: string;
    /**
     * 捕获时可见应用窗口的物理像素矩形，按从前到后的层叠顺序排列。
     */
    windows: Array<ScreenshotWindow>;
};
//# sourceMappingURL=ScreenshotCapture.d.ts.map