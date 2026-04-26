# Chat AG-UI

## Responsibility

- 在 console web 提供独立 `Chat` sidebar 入口。
- 用成熟 AG-UI client/runtime 驱动消息交互，并在前端用 `session setup` 包一层 `Chat` facade。

## External Surface

- `ChatPage`
  - mode-aware chat setup
  - AG-UI chat thread
  - advanced controls
- `Chat` sidebar section
  - route: `/chat`

## Implementation Notes

- `ChatPage` 采用 workbench shell：
  - 顶部 poster-style header 负责建立主视觉和状态锚点
  - 主体分成 `session setup rail` 与 `live thread stage`
- `ChatPage` 显式区分两种 setup mode：
  - `profile`
  - `inline`
- 主 chat 交互走 `/api/chats/{chatId}/session/ag-ui`，路径归属 chat，执行上下文是 chat 绑定的 session。
- chat history 读取 `/api/chats/{chatId}/messages`，数据源仍是 chat 绑定的 session transcript。
- inline setup option 走 `/api/chats/session-runtime-options`。
- chat 作为独立 sidebar section 挂到 shell navigation，不再作为 `OverviewPage` 的附属入口。
- chat 页面负责维护用户层 session setup draft：
  - `chatId`
  - `mode`
  - `profileId` for profile mode
  - inline config draft for inline mode
- send 前先通过 `PUT /api/chats/{chatId}` flush setup，再委托 AG-UI submit turn。
- setup flush 通过 AG-UI `MiddlewareFunction` 挂在 `HttpAgent` run 前。
- chat session agent 实现 `getCapabilities()`，读取 `/api/chats/{chatId}/session/ag-ui/capabilities`。
- 前端 AG-UI 扩展只走 CopilotKit v2 provider：
  - messages 使用 CopilotKit chat view 和 AG-UI `Message`
  - tools 使用 `renderToolCalls`
  - activity 使用 `renderActivityMessages`
  - state 使用 `useAgent().state`
- `profile` mode 创建后只读展示真实 binding。
- `inline` mode 先从页面导入 profile config，再允许后续调整 future-turn config，但不允许改 CLI identity。
- inline runtime editor 固定按 `CLI -> image variant -> provider endpoint -> model` 顺序联动。
- 主界面只保留 chat-first 输入/消息视图，不显式暴露 raw session CRUD。
- `STATE_SNAPSHOT` 用于回填 session / usage summary。
- `ACTIVITY_SNAPSHOT activityType=TURN` 用 CopilotKit activity renderer 展示当前 turn progress 和 session workflow `steps[]`。
- `MESSAGES_SNAPSHOT` 用于 AG-UI transcript 初始化和断线恢复。
- `RUN_STARTED.input` 用于当前 run 的 serialization record。
- AG-UI thread 不再把 phase/message summary 伪装成 assistant message；运行状态单独展示。
- `stop` 直接作用于当前 AG-UI turn。
- `reset warm state` 保留在 advanced controls，不混入主消息流。
- 视觉语言使用统一 chat workbench token：
  - setup rail 更像 session control
  - thread stage 更像 live run surface
  - 避免默认 card stack 和 demo-like 气质
