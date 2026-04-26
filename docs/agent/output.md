# Agent Output Contract

## responsibility

`agent.output.v1.RunOutput` is one ordered AG-UI event emitted by a run.

It is the runtime event envelope for CLI and agent outputs. The AG-UI payload itself stays in `event`; platform code only adds sequence and timestamp.

## external fields

- `sequence`
  Monotonic order inside one run.
- `timestamp`
  Event production time.
- `event`
  AG-UI event JSON object stored as `google.protobuf.Struct`.

## event model

Use AG-UI event types directly:

- lifecycle: `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`
- text: `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`
- reasoning: `REASONING_START`, `REASONING_MESSAGE_*`, `REASONING_END`
- tools: `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`
- state: `STATE_SNAPSHOT`, `STATE_DELTA`
- messages: `MESSAGES_SNAPSHOT`
- activity: `ACTIVITY_SNAPSHOT`, `ACTIVITY_DELTA`
- extension: `CUSTOM`

## implementation notes

`packages/go-contract/agui` owns shared helpers:

- `RunOutput`
- `EventStruct`
- `EventType`
- `IsRealtimeOutput`
- `StructJSON`

CLI parsers convert provider-native output into AG-UI events before publishing. Chat/session projectors consume the same event object; they must not recreate local assistant delta, reasoning delta, tool call, or final message payload types.

`IsRealtimeOutput` returns true for live message, tool, reasoning, state, and activity events. `MESSAGES_SNAPSHOT` remains a replay/synchronization event rather than a realtime output delta.

Usage is currently a platform extension because AG-UI has no stable usage event:

- `CUSTOM name=run.llm_usage`
- `CUSTOM name=run.turn_usage`

Durable chat history is projected into AG-UI `Message` records; the runtime `RunOutput` stream remains append-only event data.
