# Agent Message Contract

## responsibility

Agent message uses the official AG-UI `Message` shape. It is the durable transcript message model for user-visible chat history.

Platform code only adds ownership metadata around the message: session id, turn id, run id, sequence, and persistence timestamps.

## external fields

- `id`
  Stable message id.
- `role`
  AG-UI role such as `user`, `assistant`, `tool`, `system`, `developer`, `activity`, or `reasoning`.
- `content`
  Message content. Text messages use string content; multimodal user input may use AG-UI input content parts.
- `toolCalls`
  Assistant tool calls when the message needs durable tool-call context.
- `toolCallId`
  Tool message correlation id.
- `encryptedContent` / `encryptedValue`
  Optional continuity payloads for providers that require encrypted state.
- `activityType`
  Optional discriminator for durable activity messages when the product explicitly stores them.

## implementation notes

Use official AG-UI SDK types where available:

- Go: `github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/types.Message`
- TypeScript: `@ag-ui/core`

`packages/go-contract/agui` owns local validation and normalization helpers:

- `MessageFromRaw`
- `MessageRaw`
- `TextMessage`
- `LatestUserText`

Durable session transcript records store AG-UI messages directly. Do not add a parallel `TextPart`, `ToolCallPart`, or local agent-message schema.

