import type { ApiErrorKind } from './types.js';
/**
 * 宿主返回的结构化错误（`06 §4` 的 `ApiError`）。
 *
 * 插件据此分支处理：权限不足（`PermissionDenied`）、能力不支持（`Unsupported`）、
 * 参数非法（`InvalidArgument`）等，而不是解析字符串。
 */
export declare class ZToolsApiError extends Error {
    /** 错误类别。 */
    readonly kind: ApiErrorKind | 'Unknown';
    /** 错误详情。 */
    readonly detail: string;
    /**
     * 构造错误。
     * @param kind 错误类别。
     * @param detail 错误详情。
     */
    constructor(kind: ApiErrorKind | 'Unknown', detail: string);
    /**
     * 把任意抛出物归一化为结构化错误。
     * @param error Tauri `invoke` 抛出的原始值（通常是 `{ kind, detail }`）。
     * @returns 结构化错误实例。
     */
    static from(error: unknown): ZToolsApiError;
}
//# sourceMappingURL=errors.d.ts.map