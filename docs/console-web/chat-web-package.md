# Chat Web Package

## Responsibility

- 定义 `chat` feature package 导出的 section metadata 和 route entry。
- 在 package 内拥有 `ChatPage` 与 session-backed chat domain，不把页面装配细节泄漏到 app composition。
- 负责 `session setup facade + AG-UI thread` 的完整 operator chat surface。

## External Surface

- `CHAT_SECTION`
- `CHAT_SECTIONS`
- `CHAT_ROUTES`

## Implementation Notes

- package 内部持有 `pages/chat.tsx` 与 `domains/chat/*`。
- `ChatPage` 负责注入 workbench shell 样式并渲染 `ChatSessionCard`。
- chat domain 只消费 `/api/chats/{chatId}` 与 `/api/chats/{chatId}/session/ag-ui`。
- shell app 只组合 section 和 route，不感知 chat 内部状态管理。
