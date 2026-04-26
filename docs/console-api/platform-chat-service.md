responsibility

`platform-chat-service` owns the internal chat gRPC facade behind `console-api`.
`console-api` owns browser-facing `/api/chats*` HTTP/SSE and calls the service over gRPC.

key methods

- `platform.chat.v1.ChatService.GetSessionRuntimeOptions`
- `platform.chat.v1.ChatService.ValidateInlineSpec`
- `platform.chat.v1.ChatService.CreateChat/GetChat/UpdateChatSessionSetup/RenameChat/ListChats/ListChatMessages`
- `platform.management.v1.AgentSessionManagementService`

implementation notes

`platform-chat-service` stores chat metadata and the chat-to-session binding in
the chat repository. Session setup/state is stored through `packages/session`,
with domain outbox events for runtime reconciliation. Chat rename updates only
the chat repository. It delegates turn/run control to `platform-agent-runtime-service`
over gRPC and reads runtime option data from `platform-provider-service` over gRPC.
Chat message history is read from the shared session transcript repository.
`ListChats` and `ListChatMessages` return opaque keyset `page_token` values.
No service-to-service HTTP or SSE is used for chat.
