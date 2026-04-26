# Console Main Content Shell

## Responsibility

- 提供共享的 scrollable main content 容器，统一 console 内容区的 padding 和 surface。

## External Surface

- `ConsoleMainContentShell`
- `ConsoleMainContentShellProps`

## Implementation Notes

- 组件只包裹 `children`，不渲染 topbar、sidebar 或 route-specific header。
- `layout.css` 中的 `scrollArea` 和 `mainContent` 类负责内容区滚动与容器样式。
- 外层 shell chrome 由 `ConsoleShellLayout` 负责，`ConsoleMainContentShell` 只拥有内容区。
