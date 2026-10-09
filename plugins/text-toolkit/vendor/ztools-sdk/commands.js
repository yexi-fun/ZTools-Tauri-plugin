import { requireBridge } from './bridge.js';
import { ZToolsApiError } from './errors.js';
/**
 * 调用宿主命令并把错误归一化为 {@link ZToolsApiError}。
 * @param command 命令名。
 * @param args 命令参数。
 * @returns 宿主返回结果。
 * @throws 参数非法/权限不足/能力不支持时抛出结构化 `ZToolsApiError`。
 */
export async function call(command, args) {
    const bridge = requireBridge();
    try {
        return (await bridge.invoke(command, args));
    }
    catch (error) {
        throw ZToolsApiError.from(error);
    }
}
//# sourceMappingURL=commands.js.map