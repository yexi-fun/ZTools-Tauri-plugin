/**
 * 宿主返回的结构化错误（`06 §4` 的 `ApiError`）。
 *
 * 插件据此分支处理：权限不足（`PermissionDenied`）、能力不支持（`Unsupported`）、
 * 参数非法（`InvalidArgument`）等，而不是解析字符串。
 */
export class ZToolsApiError extends Error {
    /** 错误类别。 */
    kind;
    /** 错误详情。 */
    detail;
    /**
     * 构造错误。
     * @param kind 错误类别。
     * @param detail 错误详情。
     */
    constructor(kind, detail) {
        super(`${kind}: ${detail}`);
        this.name = 'ZToolsApiError';
        this.kind = kind;
        this.detail = detail;
    }
    /**
     * 把任意抛出物归一化为结构化错误。
     * @param error Tauri `invoke` 抛出的原始值（通常是 `{ kind, detail }`）。
     * @returns 结构化错误实例。
     */
    static from(error) {
        if (error instanceof ZToolsApiError) {
            return error;
        }
        if (typeof error === 'object' && error !== null && 'kind' in error) {
            const shape = error;
            if (typeof shape.kind === 'string') {
                return new ZToolsApiError(shape.kind, typeof shape.detail === 'string' ? shape.detail : String(shape.detail ?? ''));
            }
        }
        return new ZToolsApiError('Unknown', error instanceof Error ? error.message : String(error));
    }
}
//# sourceMappingURL=errors.js.map