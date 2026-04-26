# Agent Session Routes

## Responsibility

`console-api` exposes browser-facing `/api/chats*` routes and maps them to chat/session/run gRPC contracts.

## External Surface

- `GET /api/chats/{chatId}`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/session-runtime-options`
- `PUT /api/chats/{chatId}`
- `POST /api/chats/{chatId}:rename`
- `POST /api/chats/{chatId}:reset-warm-state`
- `GET /api/chats/{chatId}/messages`
- `POST /api/chats/{chatId}/turns`
- `POST /api/chats/{chatId}/session/ag-ui`
- `GET /api/chats/{chatId}/turns/{turnId}`
- `POST /api/chats/{chatId}/turns/{turnId}:stop`
- `POST /api/chats/{chatId}/turns/{turnId}:retry`

## Implementation Notes

- Browser HTTP/SSE terminates in `console-api`.
- Chat list/setup/read calls use `platform.chat.v1.ChatService`.
- Chat create request may include initial `displayName` plus `sessionSetup`.
- Chat setup update request only carries `sessionSetup`; rename is a separate chat metadata call.
- Chat view returns `displayName` plus `session.id/setup/state`.
- `GET /api/chats` returns recent chat metadata for browser session recovery.
- `GET /api/chats/{chatId}/messages` reads the chat-bound session transcript.
- Turn/reset and AG-UI calls resolve the one chat-bound `sessionId`, then use `AgentSessionManagementService`.
- `turnId` maps to internal `actionId`.
- reusable session defaulting and repository code lives in `packages/session`; turn-control client code lives in `internal/agentsessions`.
- `GET /api/chats/session-runtime-options` is backed by `platform.chat.v1.ChatService.GetSessionRuntimeOptions`.
- inline create/update is validated by `platform.chat.v1.ChatService.ValidateInlineSpec`.
- session/turn/run operations use `platform.management.v1.AgentSessionManagementService` on `platform-chat-service`.
- run output streaming uses `StreamAgentRunOutput` and is translated to AG-UI SSE at the browser boundary.
- AG-UI history sync uses standard `MESSAGES_SNAPSHOT`; realtime output remains `TEXT_MESSAGE_*`.
