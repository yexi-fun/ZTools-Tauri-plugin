import { ZToolsApiError } from './errors.js';
/**
 * 判断当前页面是否运行在插件窗口内（宿主桥是否可用）。
 * @returns 桥可用返回 `true`。
 */
export function isBridgeAvailable() {
    return typeof window !== 'undefined' && typeof window.__ZTOOLS__ === 'object';
}
/**
 * 取宿主桥；不可用时抛出明确错误，避免插件"静默不工作"。
 * @returns 宿主桥。
 * @throws 页面不在插件窗口（没有注入桥）时抛出 `ZToolsApiError`。
 */
export function requireBridge() {
    const bridge = typeof window === 'undefined' ? undefined : window.__ZTOOLS__;
    if (!bridge) {
        throw new ZToolsApiError('Unsupported', '当前页面不是 ZTools 插件窗口：宿主桥（window.__ZTOOLS__）不可用');
    }
    return bridge;
}
//# sourceMappingURL=bridge.js.map