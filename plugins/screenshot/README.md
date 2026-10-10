# 截图插件（外部插件示例）

用户指派：**把截图功能抽离为外部插件，并打包为 `.zpx`**。
本插件是该次改造的产物：宿主只保留原生能力（GDI 全屏捕获 / 写图片到剪贴板 / 落盘），
冻结画面、选区、标注、工具条全部在本插件里。

## 形态

- 插件 id：`com.ztools.screenshot`，功能码 `screenshot.capture`（主面板搜「截图」即可进入）；
- 两页：
  - `index.html`（入口页，跑在宿主承载插件的叠加窗口里）：进入即调用 `ztools.screen.capture()`
    抓全屏，然后 `ztools.window.open('overlay.html', { visible: false, … })` 开一个按**物理像素**
    盖住虚拟屏幕的自建窗口 —— **隐藏建窗**：窗口建好先不显示，等 overlay 页把冻结帧画进画布后
    再 `ztools.window.show()` 露脸（否则用户会先看到一个空白全屏窗口再切到冻结帧，即"屏幕闪一下"）；
  - `overlay.html`（全屏选区页，跑在插件自建窗口里）：悬停自动预选应用窗口，单击确认；
    桌面空白处单击选择全屏，也可拖动自由框选 → 矩形 / 椭圆 / 箭头 / 画笔 /
    文本 / 马赛克标注 → 撤销 / 颜色 / 线宽 → **复制**（`ztools.clipboard.writeImage`）/
    **保存**（`ztools.screen.save` → `<data_root>/screenshots/`）/ **钉住**；Enter 复制、Esc 取消。
    装载顺序：`screen.fetch()`（取入口页抓好的那张）→ 画布 → `window.show()`；
  - `pin.html`（**钉在桌面**的贴图页，跑在常驻插件窗口里）：把选区（含标注）以 1:1 贴到原位置，
    **拖动画面内部 = 移动**、**拖动边缘 / 角 = 等比缩放**（`ztools.window.setBounds`，宿主按客户区
    精确摆位）、Esc 或右上角 ✕ = 关闭。贴图窗口按 `persistent: true` 建窗，**会话结束后仍留在桌面上**。
    拖动位移按 **`screenX/screenY`** 算（`clientX` 会与"窗口跟着光标走"互相追赶 → 越拖越跟不上）；
    每帧只下发一次 `setBounds`（宿主热路径 = 一次 `SetWindowPos`），实测跟手滞后 ≤ 1 帧。
    **右键** = 宿主弹的**原生菜单**（`ztools.ui.contextMenu`）：**关闭 / 复制 / 保存 / 编辑** ——
    "编辑"会把这张贴图交给截图编辑器（`overlay.html?source=pin-edit`）原地改标注，编辑器里点「钉住」
    就把改好的图放回原位（替换原贴图）。编辑只加载贴图原图，不捕获屏幕，也不构造整屏底图；
    图片保持当前位置与缩放比例，小图窗口只额外留出工具栏空间。
- 文本标注：点"文本"后在画面上点一下输入，**回车确认 / Esc 取消输入**（输入框里的按键不会冒泡成
  全局快捷键 —— 否则回车会变成"复制整张图"、把会话直接结束，这是此前文本不可用的根因）。
- 权限（`plugin.json`）：`screen.capture`、`clipboard.write`、`window.create`，首次使用由宿主请求授权。

## 构建与打包

```bash
node scripts/build-plugins.mjs --plugin screenshot
node scripts/verify.mjs --skip-release
```

在本仓库根目录执行，产物为 `release/com.ztools.screenshot-1.0.3.zpx`，插件自带 SDK。

## 安装

设置窗口「插件 → 安装 / 更新」填入 `.zpx` 路径，或直接走宿主命令 `plugin_install`。
安装后主面板搜「截图」，或把 `screenshot.capture` 固定到超级面板。

> **1.0.2 起必须配套新宿主**：1.0.2 用 `window.open({ visible: false })` + `ztools.window.show()`
> （宿主命令 `plugin_window_show`），1.0.3 又加了 `ztools.window.setBounds`（宿主命令
> `plugin_window_set_bounds`）与窗口 `persistent` 选项。宿主没同步更新时，这些命令/选项不存在，
> 选区窗口会一直隐藏或贴图无法拖动。旧版插件与新宿主仍然兼容。

> 窗口自动预选还需要宿主在截图结果中提供 `windows` 边界；70px 右键菜单与透明窗口底色
> 同样需要近期宿主改进。请配套更新 ZTools-Tauri，单独安装插件不会更新宿主。

## 用 dev server 调试（T7-12）

本插件的清单暂时**没有** `development.entry`；要边改边看需先加上，例如
`"development": { "entry": "http://127.0.0.1:15180" }`，然后：

```powershell
python -m http.server 15180 --directory plugins/screenshot
$env:ZTOOLS_PLUGIN_DEV = 'com.ztools.screenshot'
```

宿主只在设置 `ZTOOLS_PLUGIN_DEV` 时追加"本机回环来源 + 插件窗口 + `@ztools/sdk` 命令"的
capability，dev 页面里的能力调用与生产一致；`await ztools.ui.devtools()` 打开本插件 webview 的
开发者工具。更多说明见本仓库 [插件开发指南](../../docs/插件开发指南.md)。

## 验收

以下验收命令在 **ZTools-Tauri 宿主仓库**执行，`--zpx` 指向本仓库发布包：

```bash
cargo build --release --features tauri/custom-protocol        # 在 src-tauri 下
python tools/t6-acceptance/acceptance.py                       # copy 模式：20/20 PASS
python tools/t6-acceptance/acceptance.py --autotest save --out test-results/t6/acceptance-save
python tools/t6-acceptance/pin_acceptance.py --exe src-tauri/target/verify/debug/ztools-app.exe
python tools/t6-acceptance/pin_menu_acceptance.py --exe src-tauri/target/verify/debug/ztools-app.exe
```

探针用真实宿主跑：`autoinstall(.zpx) → 进入 screenshot.capture → screen.capture →
plugin_window_open(overlay.html, {visible: false}) → overlay 画好冻结帧后 window.show() → 自动框选 +
一条矩形 + 一条真实拖拽出来的箭头 + 一段走真实输入路径的文本 → 复制 / 保存 / 钉住 → 退出`，
并断言宿主 stdout、插件窗口截图与系统剪贴板里的 DIB。详见
ZTools-Tauri 宿主仓库的 `docs/external-plugins/screenshot-plugin.md`。
