# 剪贴板（外部插件，`com.ztools.clipboard`）

剪贴板插件从"内置插件 + 宿主独立窗口"**抽离为外部插件**：与 `examples/plugins/screenshot`
同一套做法——宿主只保留原生能力，界面与交互在插件里（标准插件窗口 + `plugin://` 协议 + SDK）。

## 分工

| 层 | 内容 |
| --- | --- |
| 宿主（原生能力，不插件化） | 剪贴板序列号监视、历史落盘/去重/裁剪、文本/图片读写、粘贴注入 `Ctrl+V`、`CF_DIB → PNG` |
| 宿主 → 插件（`@ztools/sdk`） | `ztools.clipboard.{history,pasteHistory,removeHistory,clearHistory,historyImage,status}`；读需 `clipboard.read`、写需 `clipboard.write`（与其它能力同级，首次调用弹窗授权） |
| 本插件 | 列表渲染（全部 / 文本 / 图片分类页签）、**重复文本过滤（「去重」开关）**、图片缩略图、单击粘贴、清空、搜索（复用主面板输入框） |

## 与"宿主独立窗口"时代的差异

1. 窗口就是**标准插件窗口**（跟随主面板内容区），不再有 `clipboard-open` 独立窗口；
2. 插件叠加窗口 `focusable(false)` → 搜索框改用主面板输入框
   （`ztools.ui.setSubInput` + `onSubInputChange`，即 T7-1 的子输入框）；
3. 插件窗口不能订阅 Tauri 事件（T7-8 白名单）→ 进入/搜索时刷新 + 1.5s 轮询；
4. 剪贴板的 4 个开关与"粘贴后自动粘贴"**移回宿主设置窗口**（「通用」节），
   插件页只留历史列表 + 粘贴 + 清空。

## 界面（2026-10-09 调整后）

- 名称：插件名是**剪贴板**（`plugin.json` 的 `title` / `features[0].label`，也是插件窗口与
  分离窗口顶栏、设置页插件列表、主面板功能结果读到的名字）；页内不再重复显示标题。
- 顶部：一行两端——**左侧**是分类页签「全部 / 文本 / 图片」，**右侧**是「去重」开关 + 「清空」按钮
  （清空仍在最右）。
- 列表：**隐藏滚动条**但仍可滚动（滚轮 / 触控板 / 键盘）；文本条目最多两行、超出用省略号
  （完整内容见行的 `title` 提示）。
- 底栏：左侧是操作提示，右侧是「N / M 条 · 监听中」（N = 当前分类可见条数，M = 宿主历史总数）。

## 重复文本过滤（去重，2026-10-10）

宿主的去重只跟**最新一条**比哈希（`ClipboardHistory::poll`），因此 `A → B → A` 这类
序列会在历史里留下多条同内容文本。插件按条目自带的 `hash` 在**展示层**折叠：

- **默认开启**，顶部「去重」开关可随时关掉（关掉即回到"一条不落"的历史）；
- 同一文本只保留**最新**一条（宿主列表本就是时间倒序），行内的「×N」标记表示这条文本
  在历史里出现过 N 次（鼠标悬停看完整说明）；
- 去重键优先用 `hash`，只有哈希缺失时才回落到"去掉首尾空白的文本"——因此
  "看起来一样但内容不同"（例如尾部多个空格）的两条不会被误合并；
- **图片不参与**文本去重（同内容图片仍各占一条）；
- 折叠只发生在**插件页的渲染层**：宿主的 `items`、搜索（子输入框）、单击粘贴、
  清空都用原始列表，条目本身没有被删除；
- 开关状态是**页面内状态**（不落盘）：插件页在一次宿主会话里会被复用，
  退出/重进仍保留选择；宿主禁用插件、重开应用后回到默认的「开启」。

## 安装

```powershell
pnpm --filter @ztools/sdk build
node tools/pack-plugin/sync-sdk.mjs --plugin examples/plugins/clipboard
node tools/pack-plugin/pack.mjs examples/plugins/clipboard examples/plugins/clipboard/clipboard-1.0.2.zpx
```

然后：设置页 →「插件」→「导入本地插件」选 `clipboard-*.zpx` → 安装 / 更新；或主面板搜「剪贴板」。
`Ctrl+Alt+C` 会 **唤出主面板并进入本插件**（不再是独立窗口）。

## 用 dev server 调试（T7-12）

本插件的清单暂时**没有** `development.entry`，要走 dev server 需先加上，例如
`"development": { "entry": "http://127.0.0.1:15179" }`，然后：

```powershell
python -m http.server 15179 --directory examples/plugins/clipboard
$env:ZTOOLS_PLUGIN_DEV = 'com.ztools.clipboard'    # 或 * 表示全部插件
```

宿主启动时（仅当设置了 `ZTOOLS_PLUGIN_DEV`）会追加一个"只作用于本机回环来源 + 只给插件窗口 +
只放行 `@ztools/sdk` 命令"的 capability，因此 dev 页面里的 `ztools.*` 与生产一致可用；
`await ztools.ui.devtools()` 可打开本插件 webview 的开发者工具。完整步骤与机制见
`examples/plugins/hello-ztools/README.md` 的「本地运行 / 用 dev server 调试（T7-12）」。
