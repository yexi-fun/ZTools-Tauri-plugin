import type { JsonValue } from "./serde_json/JsonValue.js";
/**
 * 存储条目（`ztools.storage.list` 返回项）。
 */
export type StorageEntry = {
    /**
     * 键。
     */
    key: string;
    /**
     * 值。
     */
    value: JsonValue;
};
//# sourceMappingURL=StorageEntry.d.ts.map