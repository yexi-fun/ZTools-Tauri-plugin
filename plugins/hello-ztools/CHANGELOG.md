# Changelog

## 1.0.1 - 2026-10-09

- 同步插件自带 SDK（`vendor/ztools-sdk/`）到最新产物：补上 `MarketSourceInfo`
  类型导出，与仓库内其它插件保持同一份（48 个文件）。插件行为不变。

## 1.0.0 - 2026-10-09

- 初次发布：最小插件骨架（`over` 指令、剪贴板读写、私有存储、系统通知）。
- 自带 SDK（`vendor/ztools-sdk/`），并用 `attempt()` 统一兜住权限错误。
