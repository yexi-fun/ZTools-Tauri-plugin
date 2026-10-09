# ZTools-Tauri 插件仓库

ZTools-Tauri 的**插件中心仓库**：插件源码、市场元数据与发布流水线都在这里。
仓库形态与参考项目 [ZToolsCenter/ZTools-plugins](https://github.com/ZToolsCenter/ZTools-plugins)
一致——**GitHub 公开仓库就是市场源**，插件包与市场清单作为 GitHub Release 资产分发。

> **与参考项目唯一的实质差异：安装方式**。
> ZTools 装的是 Electron 插件 zip（v1 清单 + `preload.js`），
> ZTools-Tauri 装的是 **`.zpx`**（zip 容器 + **schema 2** 清单 + 页面自带 SDK）。
> 差异对照见文末「[与参考仓库的差异](#与参考仓库的差异)」。

---

## 目录结构

```text
ZTools-Tauri-plugin/
  plugins/<目录>/            插件源码（一个目录一个插件）
      plugin.json            清单（schema 2）
      index.html / main.js / styles.css
      vendor/ztools-sdk/     自带 SDK（插件必须自备，宿主不提供）
      logo.png               插件图标
      README.md              插件说明（市场详情页用它）
      CHANGELOG.md           版本记录（市场发布说明与版本历史用它）
  categories-mapping.json    分类 → 插件目录（市场分类导航的数据源）
  layout.yaml                市场首页布局（banner / 最新发布 / 分类导航 / 随机推荐）
  icons/                     分类图标与横幅
  scripts/                   构建与自检脚本（零 npm 依赖）
  server/serve.mjs           可选：把市场清单按 ZTools-Tauri 的接口形状跑起来（本地联调）
  .github/workflows/         CI：检测变动 → 打包 .zpx → 发 Release
  release/                   构建产物（.zpx + plugins.json + categories.json，不进版本库）
  docs/                      开发指南 / 格式与安装 / 市场与发布
```

---

## 快速开始

```bash
# 0) 前置：ZTools-Tauri 已构建 SDK（pnpm --filter @ztools/sdk build）
node scripts/sync-sdk.mjs          # 把 SDK 同步进各插件的 vendor/
node scripts/make-assets.mjs       # 生成示例插件图标与分类图标（已有 logo 不会覆盖）

# 1) 本地全量构建 + 生成市场清单 + 自检
node scripts/detect-changes.mjs --all
node scripts/build-plugins.mjs --all
ZTOOLS_PLUGINS_REPO=<owner>/<repo> node scripts/generate-plugins-json.mjs
node scripts/verify.mjs
```

产物在 `release/`：`<插件 id>-<版本>.zpx`、`plugins.json`、`categories.json`。

装到宿主，二选一：

```bash
# A. 本地安装（任何构建都能用）
#    设置 → 已安装插件 → 填入 .zpx 绝对路径 → 「导入本地插件」
release/com.example.text-toolkit-1.0.0.zpx

# B. 本地市场联调（宿主 debug 构建）
node server/serve.mjs --download-base /packages     # http://127.0.0.1:8787
set ZTOOLS_MARKET_API_BASE=http://127.0.0.1:8787     # 再启动宿主
```

---

## 贡献一个插件

1. **Fork 本仓库**，在 `plugins/` 下新建目录（目录名建议与插件短名一致，如 `my-tool`）；
2. 写好 `plugin.json`（schema 2）、页面文件、`README.md`、`CHANGELOG.md` 与 `logo.png`；
3. 跑 `node scripts/sync-sdk.mjs` 让插件带上 SDK；
4. 在 `categories-mapping.json` 里把目录名加进合适的分类（或 `other`）；
5. 本地自检：`node scripts/verify.mjs --skip-release`；
6. 提 PR。合并到 `main` 后 CI 会自动打包并发 Release，市场随之更新。

清单字段、权限分档与 SDK 用法见 **[docs/插件开发指南.md](docs/插件开发指南.md)**。

---

## 发布流程（CI）

`push main` 触发 `.github/workflows/build-and-release.yml`：

1. **检测变动插件**（`scripts/detect-changes.mjs`，只构建 `plugins/` 下有改动的目录）；
2. **同步 SDK** 并**打包 `.zpx`**（`scripts/build-plugins.mjs`）；
3. **下载上一次 Release 的市场清单**，与本次构建结果**合并**
   （否则"只发变动插件"会把其余插件挤出市场）；
4. **生成 `plugins.json` / `categories.json`**（`scripts/generate-plugins-json.mjs`）；
5. **自检**（`scripts/verify.mjs`）后创建 Release `v<日期>`，上传
   `*.zpx` + `plugins.json` + `categories.json`。

发新版本的正确姿势：改插件内容 → **递增 `plugin.json` 的 `version`** → 在 `CHANGELOG.md` 顶部加一节 → 提 PR。

---

## 示例插件

| 插件 | 适合看什么 | 指令 | 权限难点 |
| --- | --- | --- | --- |
| [`hello-ztools`](plugins/hello-ztools) | 最小骨架、生命周期、错误兜底 | 1 个 `over` | `clipboard.*`（需授权） |
| [`text-toolkit`](plugins/text-toolkit) | 一个插件多 feature、`over` 与 `regex`、载荷驱动 | 5 + 1 | `clipboard.*` + `shell.openExternal` |
| [`quick-note`](plugins/quick-note) | 文件对话框、授权范围、`storage` 记忆状态 | 3 个 `over` | `fs.read.any` / `fs.write.any`（首次调用弹确认框） |
| [`clipboard`](plugins/clipboard) | 能力留在宿主、插件只做界面（列表 / 粘贴 / 清空）、复用主面板输入框搜索、分类页签 | 无 `cmds`（按 feature `label` 进入） | `clipboard.read` / `clipboard.write`（首次调用弹确认框） |

---

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/插件开发指南.md](docs/插件开发指南.md) | 从零写插件：清单字段、生命周期、SDK 能力表、权限三档、调试、打包发布、FAQ |
| [docs/插件格式与安装.md](docs/插件格式与安装.md) | `.zpx` 格式、安装期校验规则、两种安装方式、数据落盘位置、更新语义 |
| [docs/市场与发布.md](docs/市场与发布.md) | 仓库即市场：目录约定、CI 行为、Release 资产、客户端取数方式、调试开关、自建/内网托管 |
| [docs/与ZTools插件的差异.md](docs/与ZTools插件的差异.md) | 与参考项目 ZTools（Electron）插件的逐项对照：清单字段、插件 API、迁移步骤、不能迁移的部分 |

---

## 与参考仓库的差异

| 维度 | ZTools（ZToolsCenter/ZTools-plugins） | ZTools-Tauri（本仓库） |
| --- | --- | --- |
| 仓库形态 | GitHub 公开仓库 + Release 资产 | **相同**（本项目即对标该形态） |
| 市场元数据 | `layout.yaml` + `categories-mapping.json` + `icons/` | **相同**（分类 `list` 里同样写目录名） |
| 构建脚本 | `scripts/build-plugins.js`（archiver）| `scripts/build-plugins.mjs`（自写 stored zip，**零 npm 依赖**）|
| 清单文件 | `plugin.json`，schema **1**（`preload.js` 等） | `plugin.json`，schema **2**（v1 不再兼容） |
| 包格式 | `<插件名>-<版本>.zip` | **`<插件 id>-<版本>.zpx`** |
| 运行方式 | Electron preload + 页面脚本 | Webview + `@ztools/sdk`（插件自带 SDK） |
| 市场主键 | 插件 `name` | 插件 **`id`**（反域名，与宿主注册表一致） |
| 安装 | 解压为插件目录 | `.zpx` 本地导入，或市场一键安装（下载 → 解压校验 → 注册） |
| 下载地址 | GitHub Release 资产 | **相同**（Release 资产绝对地址，宿主直接下载 `.zpx`） |
| 客户端获取列表 | 市场 HTTP 接口 | 市场 HTTP 接口（官方后端，或本仓库 `server/serve.mjs` 的本地预览） |

> 一句话：**仓库与发布流程照参考项目做，只有"包怎么打、怎么装"换成 ZTools-Tauri 的 `.zpx`。**
