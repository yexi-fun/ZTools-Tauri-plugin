# Hello ZTools（最小示例）

一个"刚好能跑起来"的 ZTools-Tauri 插件：一个 `over` 指令、剪贴板读写、私有存储、系统通知。
建议先读它，再去看 `text-toolkit`（多功能）与 `quick-note`（文件与授权）。

## 它做了什么

| 能力 | 用到的 API | 需要的权限 |
| --- | --- | --- |
| 读剪贴板 | `ztools.clipboard.readText()` | `clipboard.read` |
| 写剪贴板 | `ztools.clipboard.writeText()` | `clipboard.write` |
| 私有存储计数 | `ztools.storage.get/set/list()` | 默认允许（声明 `storage.*` 更清晰） |
| 系统通知 | `ztools.ui.showNotification()` | `notification.show` |
| 生命周期 | `bootstrap({ onEnter, onExit })` | —— |

## 目录结构

```text
hello-ztools/
  plugin.json        清单：id / 版本 / 入口 / 权限 / 功能与指令
  index.html         插件页面（运行时入口）
  main.js            页面逻辑，只通过 SDK 访问宿主
  styles.css         用宿主注入的设计令牌跟随主题
  vendor/ztools-sdk/ 自带 SDK（由 scripts/sync-sdk.mjs 同步）
  logo.png           市场与插件列表用的图标
  CHANGELOG.md       版本记录（市场发布说明与版本历史从这里取）
```

## 怎么试

1. 在主面板输入 `转大写 hello`，回车 → 面板进入本插件，并打印输入文本的大写结果；
2. 在插件页点「把剪贴板内容转大写」→ 读剪贴板、转大写、写回剪贴板；
3. 点「累计调用次数」再点「查看私有存储」→ 数据落在
   `<数据目录>/plugins/com.example.hello-ztools/data/`。

## 打包与安装

```bash
# 在仓库根目录
node scripts/sync-sdk.mjs                                    # 同步 SDK 到 vendor/
node scripts/build-plugins.mjs --plugin hello-ztools         # 打包成 release/*.zpx
node scripts/generate-plugins-json.mjs                       # 更新市场清单
node scripts/verify.mjs                                      # 自检
```

安装：设置 → 已安装插件 → 填入 `release/com.example.hello-ztools-1.0.0.zpx` 的绝对路径 →
「导入本地插件」。
