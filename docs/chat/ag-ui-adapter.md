# AG-UI Adapter

## responsibility

AG-UI is the canonical protocol for chat session messages, stream events, tool calls, state snapshots, state deltas, activity, reasoning, capabilities, and custom extension events.

Platform code only owns the envelope around AG-UI payloads: session id, turn id, run id, sequence, timestamp, persistence offset, route ownership, NATS subjects, and storage ownership.

## external fields and methods

- `agui.RunOutput` wraps one AG-UI event as `agent.output.v1.RunOutput`.
- `agui.RunStartedPayload` builds the extended `RUN_STARTED` serialization payload with `input` and optional `parentRunId`.
- `agui.EventType` reads the AG-UI event type from a persisted output envelope.
- `agui.EventFromOutput` validates a persisted output event through the official Go AG-UI event decoder.
- `agui.IsRealtimeEventType` classifies live stream events for delta publishing.
- `agui.MessageFromRaw`, `agui.MessageFromStruct`, `agui.MessageRaw`, `agui.MessageStruct`, and `agui.TextMessage` validate durable transcript messages as AG-UI `Message`.

## implementation notes

Use official AG-UI SDK event and message types first. Keep `CUSTOM` only for platform extensions such as run usage. Do not emit deprecated `THINKING_*`; use `REASONING_*`.

## concept mapping

- agents: `/api/chats/{chatId}/session/ag-ui` is the chat-owned `HttpAgent` route for the one bound session.
- middleware: frontend setup flush is an AG-UI middleware; backend stream handling validates, deduplicates, projects usage, and terminates the run stream.
- messages: durable transcript records are AG-UI `Message` objects and are replayed with `MESSAGES_SNAPSHOT`.
- state: session and usage summary are AG-UI shared state and are emitted with `STATE_SNAPSHOT`; add `STATE_DELTA` only when the state object becomes large or high-frequency.
- serialization: `RUN_STARTED.input` records the exact agent input; persisted run output keeps ordered AG-UI events; result compaction projects final messages into the session repository.
- tools: CLI tool observations must become `TOOL_CALL_*` and `TOOL_CALL_RESULT`; `TOOL_CALL_START.parentMessageId` links the call to the assistant message stream; durable replay projects `TOOL_CALL_START`/`TOOL_CALL_ARGS`/`TOOL_CALL_END` or `TOOL_CALL_CHUNK` into assistant `toolCalls` and `TOOL_CALL_RESULT` into AG-UI `tool` messages.
- reasoning: CLI thinking output must become `REASONING_*`; message streams are wrapped by `REASONING_START` and `REASONING_END`; encrypted reasoning can be added without changing the envelope.
- activity: progress, plans, and long-running non-message status use `ACTIVITY_SNAPSHOT` or `ACTIVITY_DELTA`, not assistant text or custom state events; chat emits `activityType=TURN` for the current turn progress and `steps[]` for prepare/execute workflow progress.
- capabilities: expose current route/runtime support through AG-UI capabilities discovery; declare only supported standard fields such as streaming transport, tool events, reasoning streams, state snapshots, and message serialization. Activity support is declared under `custom.activity` because the current AG-UI capabilities schema has no standard activity category. TypeScript clients validate with official `@ag-ui/core` `AgentCapabilitiesSchema`; the current Go SDK does not expose the same core capabilities type, so the backend keeps the JSON projection minimal.

## proto note

`@ag-ui/proto` currently provides TypeScript binary encode/decode helpers for AG-UI events. The Go SDK surface in use here exposes typed events, JSON encoding, SSE, and validation, but not a generated Go proto event message.

Internal protobuf envelopes therefore keep `RunOutput.event` as `google.protobuf.Struct`. This preserves AG-UI JSON compatibility across Go services and browser clients without defining a second event schema.
