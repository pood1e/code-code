# Chat AG-UI Endpoint

## Responsibility

- `console-api` exposes the browser-facing AG-UI chat endpoint.
- Internal state and output reads use gRPC through `platform-chat-service`.
- The endpoint maps AG-UI `run` requests to the internal `Chat -> Session -> Turn -> AgentRun` chain.

## External Surface

- `POST /api/chats/{chatId}/session/ag-ui`
- `GET /api/chats/{chatId}/session/ag-ui/capabilities`
- request body: AG-UI `RunAgentInput`
- response: `text/event-stream`

## Implementation Notes

- AG-UI `threadId` defaults to the chat-bound `sessionId`.
- `RUN_STARTED` includes the normalized `RunAgentInput` as `input`; `parentRunId` is preserved when supplied.
- The stream emits `MESSAGES_SNAPSHOT` from the bound session transcript before live run events.
- The stream emits session and usage state only through `STATE_SNAPSHOT`; custom events are reserved for platform extensions such as usage counters.
- The stream emits turn progress through `ACTIVITY_SNAPSHOT` with `activityType=TURN`.
- The endpoint extracts the latest user text message and maps it to `RunRequest.input.text`.
- chat setup only goes through `PUT /api/chats/{chatId}`.
- chat metadata and the one-to-one session binding are loaded through `platform.chat.v1.ChatService`.
- live session state is read through the session control surface after binding resolution.
- assistant text, tool call summary, and usage come from `StreamAgentRunOutput` over gRPC.
- SSE is only the browser boundary protocol; it is not used between services.
- turn creation uses the internal `AgentSessionManagementService` mainline.
- client disconnect triggers best-effort `stop` for the current action.
- capabilities discovery declares the currently supported AG-UI surface: SSE streaming, tool events, reasoning streams, state snapshots, persistent state, activity snapshots, message snapshots, and run-started input serialization.
