# 与 ZTools 插件的差异

本仓库的仓库结构、发布流程、市场机制都照搬参考项目
[ZToolsCenter/ZTools-plugins](https://github.com/ZToolsCenter/ZTools-plugins)，
**唯一的实质差异是"插件怎么写、怎么打包、怎么装"**——因为 ZTools-Tauri 不是 Electron。

如果你手里已经有一个 ZTools（Electron）插件，本文给出逐项对照与迁移步骤。

---

## 1. 一张表看全差异

| 维度 | ZTools（参考仓库） | ZTools-Tauri（本仓库） |
| --- | --- | --- |
| 仓库定位 | GitHub 公开仓库即市场源 | **相同** |
| 仓库布局 | `plugins/<名>/` + `categories-mapping.json` + `layout.yaml` + `icons/` | **相同** |
| 构建产物 | `<插件名>-<版本>.zip` | **`<插件 id>-<版本>.zpx`** |
| 产物分发 | Release 资产 + `plugins.json` | **相同**（另加 `categories.json`） |
| 清单文件 | `plugin.json`，schema **1** | `plugin.json`，schema **2** |
| 运行方式 | Electron `preload.js` + 页面脚本 | Webview 页面 + `@ztools/sdk`（插件自带） |
| 插件 API | 页面里的 `window.ztools.*`（preload 注入） | 页面里 `import { ztools } from './vendor/ztools-sdk/index.js'` |
| 市场主键 | 插件 `name` | 插件 **`id`**（反域名） |
| 分类 | 清单里的 `categories` 字段 | 仓库根 `categories-mapping.json`（清单里不再有该字段） |
| 安装 | 解压到插件目录 | `.zpx` 本地导入，或市场一键安装（下载 → 校验 → 解压 → 注册） |
| 数据目录 | 插件自己的目录 | `plugins/<id>/`，私有存储在 `plugins/<id>/data/storage.json` |

> 一句话：**外壳（仓库、发布、市场）照参考项目做，内核（清单 schema、包格式、运行时）换成本项目的。**

---

## 2. 清单字段对照

左边是参考仓库里的真实 v1 清单（取自 `plugins/address-parser/plugin.json`），
右边是等价的 v2 写法：

```jsonc
// ZTools v1
{
  "name": "address-parser",
  "title": "收货地址智能解析",
  "description": "…",
  "author": "harris",
  "version": "0.1.0",
  "main": "index.html",
  "preload": "preload.js",
  "logo": "logo.svg",
  "categories": ["productivity", "text"],
  "pluginSetting": { "single": true, "height": 760 },
  "features": [
    {
      "code": "address-parser",
      "explain": "收货地址智能解析",
      "icon": "logo.svg",
      "cmds": [
        "收货地址解析",
        { "type": "regex", "label": "解析选中的收货地址", "match": "/…/", "minLength": 11 }
      ]
    }
  ]
}
```

```jsonc
// ZTools-Tauri v2
{
  "schema": 2,
  "id": "com.example.address-parser",
  "name": "address-parser",
  "title": "收货地址智能解析",
  "description": "…",
  "author": "harris",
  "version": "0.1.0",
  "logo": "logo.svg",
  "runtime": { "type": "webview", "entry": "index.html" },
  "development": { "entry": "http://127.0.0.1:15180" },
  "permissions": ["clipboard.read", "notification.show"],
  "features": [
    {
      "code": "address-parser",
      "label": "收货地址智能解析",
      "icon": "logo.svg",
      "cmds": [
        { "type": "over", "label": "收货地址解析", "minLength": 1, "maxLength": 2000 },
        { "type": "regex", "label": "解析选中的收货地址", "match": "/…/" }
      ]
    }
  ]
}
```

逐项说明：

| v1 | v2 | 说明 |
| --- | --- | --- |
| （无 `schema`，隐式 1） | `schema: 2` | **必填**；v1 包会被宿主明确拒绝 |
| `name`（兼作主键） | `id` + `name` | `id` 必须是反域名（如 `com.example.address-parser`），**市场主键就是它**；`name` 只是可读短名 |
| `main` | `runtime: { type: "webview", entry }` | `type` 目前只支持 `webview`；`entry` 必须是安全相对路径 |
| `preload` | **删除** | Tauri 侧没有 Electron preload；页面直接 import SDK |
| `features[].explain` | `features[].label` | 字段改名，含义不变 |
| `features[].cmds` 里的**裸字符串** | 必须写成对象 | v2 只接受 `{ type: "over" \| "files" \| "regex", … }`；裸字符串请改写成 `{ "type": "over", "label": "原字符串", "minLength": 1, "maxLength": 2000 }` |
| `categories`（清单内） | 仓库根 `categories-mapping.json` | v2 清单没有该字段（宿主忽略未知字段，但市场分类不会生效）；把插件目录名加进对应分类的 `list` 即可 |
| `pluginSetting.height` | 运行时 `ztools.ui.setHeight(h)` | v2 清单没有面板设置；需要固定高度就在页面里调 |
| `homepage` | —— | v2 清单不支持；可写在插件 README 里 |
| `logo` 支持 `.svg` | ✅ 同样支持 | 市场列表用的图标（构建时内嵌为 base64） |
| —— | `permissions[]` | **v2 新增**：能力必须显式声明，未声明一律拒绝（见《插件开发指南》§5） |
| —— | `development.entry` | **v2 新增**：开发态从本地 dev server 加载页面 |

---

## 3. 插件 API 对照

v1 插件通过 preload 注入的 `window.ztools.*` 调宿主（例如
`window.ztools.onPluginEnter(cb)`）；v2 插件在页面里 import SDK：

```js
// v1
window.ztools.onPluginEnter((param) => { /* … */ })

// v2
import { bootstrap, ztools } from './vendor/ztools-sdk/index.js'
bootstrap({ onEnter(event) { /* event.code / event.payload */ } })
```

能力集合是一致的，但**命名不一定逐字相同**（生命周期、通知、剪贴板这几类都不完全一样），
所以别只做一次全局字符串替换就收工——请按下面的表逐项对照：

| 能力 | v2 调用（本仓库） | 备注 |
| --- | --- | --- |
| 生命周期 | `bootstrap({ onEnter, onExit, onBackground, onDisable, onPluginDetach })` | v1 用 `window.ztools.onPluginEnter(cb)` 这类回调（本仓库示例：`plugins/address-parser/app.js`）；退出等回调命名以参考项目为准 |
| 剪贴板 | `ztools.clipboard.readText / writeText / readFiles / writeFiles / writeImage / history / pasteHistory / …` | 需 `clipboard.read` / `clipboard.write`（首次调用弹授权） |
| 私有存储 | `ztools.storage.get / set / remove / list / clear` | 默认允许，落 `plugins/<id>/data/storage.json` |
| 通知 | `ztools.ui.showNotification({ title, body })` / `ztools.ui.toast(…)` | 需 `notification.show` |
| 主面板子输入框 | `ztools.ui.setSubInput / removeSubInput / setSubInputValue / onSubInputChange` | 对应 v1 的子输入框系列 |
| 面板高度 | `ztools.ui.setHeight(h)` | 对应 v1 的窗口尺寸设置 |
| 分离到独立窗口 | `ztools.ui.detach()` | —— |
| Shell | `ztools.shell.openExternal / openPath / showItemInFolder / trash / beep` | `openExternal` 只放行 http/https/mailto/tel |
| 系统对话框 | `ztools.dialog.openFile / saveFile / showMessage` | 需 `dialog.open` |
| 文件读写 | `ztools.fs.readText / writeText / list` | 需 `fs.read.any` / `fs.write.any`，且**只能访问用户经对话框授权过的范围** |
| 受限 HTTP | `ztools.http.request` | 需 `network`；由宿主发起，不放宽页面 CSP |
| 键鼠模拟 | `ztools.input.key / type / mouse` | 需 `input.simulate` |
| 截图 | `ztools.screen.capture / fetch / save` | 需 `screen.capture` |
| 插件自建窗口 | `ztools.window.open / close` | 需 `window.create` |
| 动态功能 | `ztools.features.list / set / remove` | 需 `features.manage` |
| 退出插件 | `ztools.exit()` | —— |

> 精确签名以 SDK 的类型定义为准：`vendor/ztools-sdk/index.d.ts`
> （本仓库《插件开发指南》§6 有完整能力表）。
> v1 侧的方法名与签名请对照参考项目自身文档——两边的**能力集合一致，命名大体相同但不是逐字兼容**。

---

## 4. 从 ZTools 插件迁移：操作清单

1. **拷目录**：把插件目录放进本仓库的 `plugins/<短名>/`（短名建议与 v1 的 `name` 一致）；
2. **改清单**：
   - 加 `schema: 2`；
   - 加反域名 `id`（`com.example.<短名>` 这种最省事）；
   - `main` → `runtime: { "type": "webview", "entry": "index.html" }`；
   - 删掉 `preload`；
   - `features[].explain` → `label`；裸字符串 `cmds` → `{ "type": "over", … }`；
   - 删掉 `categories`（改到仓库根的 `categories-mapping.json`）与 `pluginSetting`；
   - **补 `permissions`**（v2 不再默认放行任何能力）；
3. **改代码**：`window.ztools.*` → `ztools.*`（SDK）；`onPluginEnter` → `bootstrap({ onEnter })`；
   Electron/Node 专有的东西要删（见 §5）；
4. **自带 SDK**：`node scripts/sync-sdk.mjs` 把 SDK 拷进 `vendor/ztools-sdk/`；
5. **补 README / CHANGELOG / logo**（市场详情页与发布说明要用）；
6. **归入分类**：在 `categories-mapping.json` 的某个分类 `list` 里加上目录名；
7. **自检**：`node scripts/verify.mjs --skip-release`；
8. **本地试装**：见《插件格式与安装》§7（用本地镜像把市场指到自己的构建产物）；
9. **提 PR**：合并后 CI 自动打包发 Release，市场随之更新。

---

## 5. 不能直接迁移的部分

这些是 Electron 侧才有的东西，v2 里没有对应物，需要改写法或直接去掉：

| v1 用法 | 为什么不行 | v2 替代 |
| --- | --- | --- |
| `require('electron')` / `ipcRenderer` / `ipcMain` | 没有 Electron 进程模型 | 一律走 `ztools.*`（SDK 内部就是 Tauri IPC） |
| `preload.js` 里的 Node API（`fs` / `path` / `child_process`） | Webview 页面里没有 Node | 文件用 `ztools.fs.*`（受授权范围限制）；其它能力看《插件开发指南》§6 有没有对应点 |
| `nodeIntegration` / `webSecurity: false` | 宿主不使用也不提供这类不安全开关 | 用 SDK 提供的受限能力（例如 `ztools.http.request` 代替直接 fetch 跨域） |
| `new BrowserWindow(...)` | 页面不能自己开 Electron 窗口 | `ztools.window.open(...)`（需 `window.create`） |
| 直接读写 `~/.ztools` 之类的宿主文件 | 插件拿不到宿主路径 | 私有存储用 `ztools.storage`，缓存用 `ztools.files.cacheDir()` |

---

## 6. 两边各看一个真实例子

| | v1（参考仓库） | v2（本仓库） |
| --- | --- | --- |
| 清单 | `plugins/address-parser/plugin.json`（无 `schema`、有 `preload`、`cmds` 里混用字符串与对象） | [`plugins/text-toolkit/plugin.json`](../plugins/text-toolkit/plugin.json)（schema 2、`runtime`、6 个 feature、`over` + `regex`） |
| 代码 | `app.js` + `preload.js`，`window.ztools.onPluginEnter(...)` | [`plugins/text-toolkit/main.js`](../plugins/text-toolkit/main.js)，`bootstrap({ onEnter })` + `ztools.*` |
| 权限 | 无声明（Electron 里直接用 Node/Electron 能力） | `clipboard.*` / `shell.openExternal`（Explicit 权限首次调用弹授权） |
| 发布 | `plugins/<名>/` → CI 打 zip → Release | `plugins/<目录>/` → CI 打 `.zpx` → Release（同一套流程） |
