# 剪贴板

剪贴板历史查看器：按「全部 / 文本 / 图片」浏览历史、单击把内容写回剪贴板、一键清空。

## 它能做什么

| 能力 | 说明 |
| --- | --- |
| 历史列表 | 列出宿主记录的剪贴板历史（文本 + 图片）；图片条目显示缩略图、分辨率与体积 |
| 分类浏览 | 顶部页签「全部 / 文本 / 图片」，只切换展示，不动宿主返回的原始列表 |
| 单击粘贴 | 点任意条目 → 写回系统剪贴板；宿主再按设置决定是否注入 `Ctrl+V` |
| 清空 | 「清空」删除全部历史（含图片文件），点击前会二次确认 |
| 搜索 | 复用**主面板输入框**（本插件页里没有输入框），边打边过滤 |

## 进入方式

| 方式 | 说明 |
| --- | --- |
| 主面板搜索 | 输入 `剪贴板` 选中本插件的功能项；宿主另有系统项「剪贴板历史」 |
| 全局快捷键 | 默认 `Ctrl+Alt+C`：唤出主面板并进入本插件，再按一次退出 |

## 权限

| 权限 | 用途 | 何时要授权 |
| --- | --- | --- |
| `clipboard.read` | 读历史列表、图片缩略图与监视状态（`ztools.clipboard.history` / `historyImage` / `status`） | 首次调用弹一次确认框（Explicit 档） |
| `clipboard.write` | 粘贴（写回剪贴板）与清空历史（`pasteHistory` / `clearHistory` / `removeHistory`） | 同上 |

清单里声明了权限仍会在**首次真正调用**时弹确认框（允许 / 本次允许 / 拒绝 / 永久拒绝），
拒绝后插件收到 `permissionDenied`，界面会把错误显示在底栏而不是白屏。

## 数据放在哪

| 数据 | 位置 |
| --- | --- |
| 文本历史 | 宿主的文档库（`<数据目录>/store/`，文档 id `CLIPBOARD/<id>`） |
| 图片历史 | `<数据目录>/clipboard/images/`（存**原始 CF_DIB**，缩略图按需转 PNG 经 IPC 传回） |
| 监视 / 去重 / 裁剪的开关 | 宿主设置 →「通用 → 剪贴板」（启用、条数上限、保留天数） |
| 粘贴后是否自动 `Ctrl+V` | 宿主设置 →「通用 → 剪贴板 → 粘贴后自动粘贴」 |

> **分工**：监视（`GetClipboardSequenceNumber` 轮询）、连续去重、条数/天数裁剪、图片转换与
> 粘贴注入全部在**宿主**（常驻后台线程）；本插件只做界面，经 `@ztools/sdk` 调
> `plugin_clipboard_history_*` / `plugin_clipboard_status`，不直接读宿主内部数据。

## 界面约定

- 顶部一行两端：分类页签贴左，「清空」贴右；
- 列表**隐藏滚动条**（滚轮 / 触控板 / 键盘仍可滚动）；文本条目最多两行、超出用省略号
  （完整内容见悬停提示）；
- 底栏左侧是操作提示，右侧是「可见条数 / 总数 条 · 监听中」；
- 颜色与底色跟随宿主主题（浅色 / 深色）。

## 目录结构

```text
clipboard/
  plugin.json        清单：feature `clipboard.open` + clipboard.read / clipboard.write
  index.html         页签 / 清空 / 列表 / 底栏
  main.js            列表渲染、分类过滤、图片缩略图、粘贴、清空、子输入框搜索
  styles.css         跟随宿主主题
  vendor/ztools-sdk/ 自带 SDK（由 scripts/sync-sdk.mjs 同步）
  logo.png           图标
  CHANGELOG.md       版本记录（市场发布说明从这里取）
```

## 打包与安装

```bash
node scripts/sync-sdk.mjs
node scripts/build-plugins.mjs --plugin clipboard
node scripts/verify.mjs --skip-release
```

产物是 `release/com.ztools.clipboard-<版本>.zpx`；装到宿主：设置 →「已安装插件」→
填入 `.zpx` 绝对路径 →「导入本地插件」（或走本仓库的市场联调 `server/serve.mjs`）。
