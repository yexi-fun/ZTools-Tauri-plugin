import type { PluginLifecycleEvent } from './types.js';
/**
 * 宿主注入的桥（由 `src-tauri/src/sdk_bridge.rs` 的 `initialization_script` 提供）。
 *
 * 插件**不直接引用** `@tauri-apps/api`（`02 §2` 的边界约定），只通过这里的窄接口访问宿主。
 */
export interface ZToolsBridge {
    /** 桥协议版本。 */
    readonly version: number;
    /** 是否已完成 `plugin_ready` 握手。 */
    readonly ready: boolean;
    /**
     * 调用宿主命令。
     * @param command 命令名（Rust 函数名，见 06 §2 与 T0-2 的命名发现）。
     * @param args 命令参数（camelCase）。
     * @returns 宿主返回结果。
     */
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    /**
     * 订阅生命周期事件。
     * @param handler 事件处理器。
     * @returns 取消订阅函数。
     */
    onLifecycle(handler: (event: PluginLifecycleEvent) => void): () => void;
    /**
     * 订阅命名事件（剪贴板变化、主题变化等，M3 起使用）。
     * @param name 事件名。
     * @param handler 事件处理器。
     * @returns 取消订阅函数。
     */
    on(name: string, handler: (payload: unknown) => void): () => void;
}
/** 宿主桥的全局挂载点。 */
declare global {
    interface Window {
        /** 由宿主注入的 SDK 桥；不在插件窗口中时不存在。 */
        __ZTOOLS__?: ZToolsBridge;
    }
}
/**
 * 判断当前页面是否运行在插件窗口内（宿主桥是否可用）。
 * @returns 桥可用返回 `true`。
 */
export declare function isBridgeAvailable(): boolean;
/**
 * 取宿主桥；不可用时抛出明确错误，避免插件"静默不工作"。
 * @returns 宿主桥。
 * @throws 页面不在插件窗口（没有注入桥）时抛出 `ZToolsApiError`。
 */
export declare function requireBridge(): ZToolsBridge;
//# sourceMappingURL=bridge.d.ts.map