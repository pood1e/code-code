# Platform Chat Service

## Responsibility

`platform-chat-service` owns chat product metadata and the chat-facing gRPC facade behind browser chat.

## External Methods

- `platform.chat.v1.ChatService.GetSessionRuntimeOptions`
- `platform.chat.v1.ChatService.ValidateInlineSpec`
- `platform.chat.v1.ChatService.CreateChat/GetChat/UpdateChatSessionSetup/RenameChat/ListChats/ListChatMessages`
- `platform.management.v1.AgentSessionManagementService`

## Implementation Notes

- `ChatService` stores `Chat` metadata and `sessionId` binding in the chat repository.
- Session setup/state is read and written through the reusable session repository.
- Chat setup writes chat metadata and session state through one unit of work; the two repositories do not own the same data.
- The session repository writes domain outbox events for NATS-backed controller reconciliation.
- `platform-chat-service` wiring chooses and injects chat/session repository storage dependencies.
- `ListChats` returns recent chat metadata, including `displayName`, scoped by `scopeId`; it does not return turn history.
- `ListChatMessages` reads the bound session transcript from `packages/session`.
- Browser-created chats default `sessionId` to `chatId`; each chat has one bound session.
- Session spec defaulting and persistence live in `packages/session`; management client code is control-plane only.
- Service-to-service traffic is gRPC only.
- Browser HTTP/SSE stays in `console-api`.
- Agent session controller reconciliation and turn/run orchestration are delegated to `platform-agent-runtime-service`.
- Turn queue state and runtime output are not stored in `platform-chat-service`; durable transcript messages are stored through the shared session repository.
- Runtime options combine provider metadata from `platform-provider-service` and latest available runtime images from `platform-cli-runtime-service`; CLI version is not a chat field.
