/**
 * 市场里的一个插件条目。
 *
 * 服务端原始字段（`name` / `version` / `title` / `description` / `author` / `logo` /
 * `homepage` / `size` / `downloadCount` / `updatedAt` / `categoryTitle` / `downloadUrl`）
 * 全部可选；`installed*` 三个字段由**宿主**按本地注册表补齐，供设置页显示"安装 / 更新"。
 */
export type MarketPlugin = {
    /**
     * 插件唯一名称（市场主键，与本地注册表的插件 **id** 对应）。
     */
    name: string;
    /**
     * 市场上的最新版本。
     */
    version: string;
    /**
     * 展示标题。
     */
    title: string | null;
    /**
     * 一句话描述。
     */
    description: string | null;
    /**
     * 作者。
     */
    author: string | null;
    /**
     * 图标 URL。
     */
    logo: string | null;
    /**
     * 主页 / 仓库地址。
     */
    homepage: string | null;
    /**
     * 包大小（字节）。
     */
    size: number | null;
    /**
     * 下载次数。
     */
    downloadCount: number | null;
    /**
     * 最近更新时间（Unix 毫秒）。
     */
    updatedAt: number | null;
    /**
     * 分类标题。
     */
    categoryTitle: string | null;
    /**
     * 服务端可选提供的下载地址（相对或绝对）；有则安装时优先使用。
     */
    downloadUrl: string | null;
    /**
     * 本机是否已安装该插件（宿主补齐）。
     */
    installed: boolean;
    /**
     * 本机已安装版本（未安装时为空；宿主补齐）。
     */
    installedVersion: string | null;
    /**
     * 市场上是否有更新（已安装且版本不同 → `true`；宿主补齐）。
     */
    updateAvailable: boolean;
};
//# sourceMappingURL=MarketPlugin.d.ts.map