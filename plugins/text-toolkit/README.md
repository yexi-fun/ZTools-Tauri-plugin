# 文本工具箱

多指令插件示例：一个插件声明 5 个 feature，覆盖 `over` 与 `regex` 两类指令，
并把结果存进插件私有存储。

## 指令一览

| 在主面板输入 | 触发方式 | 进入后默认执行 |
| --- | --- | --- |
| `转大写 …` | `over`（1–2000 字） | 转大写 |
| `转小写 …` | `over` | 转小写 |
| `清理文本 …` | `over` | 去掉行尾空白、合并连续空行 |
| `行去重 …` | `over` | 按行去重（保留首次出现顺序） |
| `文本统计 …` | `over` | 字符 / 词 / 行 / 最长行 |
| `https://…` | `regex`（整串是链接） | 统计，并提供「用浏览器打开」 |

`over` 指令的载荷是**主面板输入框文本**，插件在 `onEnter(event.payload)` 里拿到它；
`regex` 指令同理，只是它的出现条件是输入匹配 `^https?://\S+$`。

## 用到的权限

| 权限 | 用途 | 说明 |
| --- | --- | --- |
| `clipboard.read` | 「读剪贴板」 | 首次调用会弹一次授权确认 |
| `clipboard.write` | 「写回剪贴板」 | 同上 |
| `shell.openExternal` | 「用浏览器打开」 | 只放行 http/https/mailto/tel |
| `notification.show` | 写回剪贴板后的提示 | —— |
| `storage.read/write` | 最近 5 次结果 | 默认允许 |

## 目录结构

```text
text-toolkit/
  plugin.json        5 个 feature + over/regex 指令声明
  index.html         源文本 / 操作 / 结果三段式界面
  main.js            操作实现（纯函数）+ 载荷处理 + 历史存储
  styles.css         跟随宿主主题
  vendor/ztools-sdk/ 自带 SDK
  logo.png           图标
  CHANGELOG.md       版本记录（市场发布说明从这里取）
```

## 开发者可以照抄的三件事

1. **一个插件多个功能**：`features[]` 每项一个 `code`，主面板会分别搜到它们；
2. **载荷驱动**：进入即执行由 `event.code` 决定，用户不必再点一次按钮；
3. **权限失败的兜底**：所有能力调用都经过 `attempt()`，被拒时在日志里显示
   `kind + message`，不会白屏。
