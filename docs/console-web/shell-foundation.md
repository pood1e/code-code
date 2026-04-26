# Console Web Shell Foundation

## Responsibility

- 提供 console-web 共享的 transport、async rendering 和 shell local state primitives。
- 让 shell app 与 feature packages 复用同一套请求、状态渲染和主题/侧栏状态约定。

## External Surface

- `jsonRequest<T>(path, init)`
- `jsonFetcher<T>(path)`
- `AsyncState({ loading, error, isEmpty, emptyTitle, emptyDescription, errorTitle, errorDescription, onRetry, children })`
- `useThemeMode()`
- `useResponsiveSidebarState(isMobile)`

## Implementation Notes

- `jsonRequest` 从 `VITE_CONSOLE_API_BASE_URL` 组装 URL，统一处理 JSON error payload、`204` 和 empty body。
- `AsyncState` 只渲染 loading、error、empty、ready 四种内容状态，不发起数据请求。
- `useThemeMode` 优先读取 `localStorage`，回退到 `prefers-color-scheme`；`useResponsiveSidebarState` 在 mobile breakpoint 变化时重置 collapsed state。
