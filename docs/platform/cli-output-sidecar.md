# CLI Output Sidecar

`CLIOutputSidecar` 是 CLI-backed workload 的解析 sidecar。

## Responsibility

它负责：

- 为主容器提供同 Pod 的 raw output sink
- 按 `cli_id` 加载 parser bundle
- 解析 CLI 结构化 raw stream
- 将 raw event 归一化为 ordered `agent.output.v1.RunOutput`
- 维护 run-local accumulator
- 暴露 pod-local gRPC control/query surface

它不负责：

- credential rewrite
- 主容器 CLI 进程生命周期
- `TurnOutput` / timeline / SSE 投影
- cluster-wide fanout

## Mainline

```text
CLIOutputSidecar startup
  -> create FIFO + UDS socket + ready file
  -> main container starts after sidecar ready
  -> main container runs CLI in structured output mode
  -> merged stdout/stderr -> raw FIFO
  -> sidecar parser bundle(cli_id) -> RunOutput stream
  -> AG-UI RunOutput events / terminal status -> JetStream
  -> downstream projection path writes timeline / TurnOutput / SSE
```

## Raw Stream Contract

shared volume 主线：

- `/run/cli-output/raw/events.fifo`
- `/run/cli-output/raw/terminal.json`
- `/run/cli-output/status/ready`
- `/run/cli-output/grpc/sidecar.sock`

规则：

- 主容器必须把 merged `stdout + stderr` 重定向到 `events.fifo`
- raw stream 必须是 line-delimited structured output
- sidecar readiness 必须表示 FIFO、UDS socket、parser bundle 都已就绪
- `terminal.json` 只表达主容器 exit semantics，不承载 output truth

## Runtime Env Contract

The AgentRun Kubernetes Job step must inject:

- `CLI_OUTPUT_CLI_ID`
- `CLI_OUTPUT_RUN_ID`
- `CLI_OUTPUT_SESSION_ID`
- `CLI_OUTPUT_NATS_URL`
- `CLI_OUTPUT_WORK_DIR`

规则：

- `CLI_OUTPUT_CLI_ID` 使用 CLI specialization identity，例如 `codex` / `qwen-cli`。
- sidecar 输入变量统一使用 `CLI_OUTPUT_*` 命名。
- terminal result 只发布到 `platform.run.result.<session_id>.<run_id>`，由平台侧 NATS consumer 落库。

## gRPC Surface

proto package 主线建议：

- `agent.runtime_sidecar.v1`

service 主线建议：

- `GetAccumulator`
  - 语义：返回当前累计态
- `Stop`
  - 语义：请求当前 run 停止

最小消息面：

- `GetAccumulatorResponse`
  - `last_sequence`
  - `assistant_text`
  - `reasoning_text`
- `StopRequest`
  - `force`
- `StopResponse`
  - `accepted`

规则：

- gRPC 只走 Pod 内 UDS，不暴露 ClusterIP / Ingress
- gRPC 不承接 hot stream；hot path 统一走 JetStream event stream
- `Stop` 只写 stop marker；主容器自己转发 signal 给 CLI child

## Traffic Mainline

流量最低的主线是：

- Pod 内 `FIFO + UDS unary gRPC`
- AG-UI event / terminal status 只从 sidecar 向外发一次 JetStream
- `GetAccumulator` 只在重连、调试、就地观测时调用
- pod 外实时 fanout 统一走下游 `NATS/SSE`

原因：

- `FIFO` 是最轻的 pod 内热流输入面
- hot path 不重复维护 gRPC stream 和 JetStream 两套分发
- `acc` 留在本地状态，不把累计文本反复写入消息总线
- pod 外消费者统一复用 JetStream，不直连 sidecar

## Event Streams

JetStream 主线拆成三条：

- `run_delta`
  - 作用：live delta fanout
- `run_result`
  - 作用：terminal/result fanout 与 result projector 输入
- `run_status`
  - 作用：低频状态变化 fanout

规则：

- realtime AG-UI event、result AG-UI event、status 不混在同一个 stream
- subjects 主线：
  - `platform.run.delta.<session_id>.<run_id>`
  - `platform.run.result.<session_id>.<run_id>`
  - `platform.run.status.<session_id>.<run_id>`
- `run_status` 只发状态变化，不发高频心跳
- `run_result` 必须继续投影到持久层；JetStream 不是最终真相

## Parser Bundle

parser bundle 按 `cli_id` 分派，owner 在 `deploy/agents/sidecars/cli-output`。

公用抽象先固定为：

- `Parser`
  - `ParseLine(line, at)`：消费一行 structured output
- `Finalize(at)`：补终态 AG-UI end event
- `Snapshot()`：导出当前 accumulator
- `Registry`
  - 按 `cli_id` 注册 parser factory
- `Builder`
  - 统一维护 `sequence`
  - 统一处理 snapshot-to-delta
  - 统一产出 AG-UI `RunOutput`

每个 parser 只保留 run-local 状态：

- `cli_session_id`
- `assistant_buffer`
- `reasoning_buffer`
- `pending_tool_calls`
- `usage_dedupe_keys`
- `sequence`

通用规则：

- 非 JSON diagnostic line 直接忽略
- snapshot 型 message 必须按 buffer 计算 delta
- 如果 CLI result 自带 final accumulated text，按 accumulator 追加缺失 delta 并关闭 AG-UI message stream
- 如果 CLI result 不带 final accumulated text，使用本地 accumulator 补齐 AG-UI message end event
- sidecar 只发布 AG-UI event envelope，不发布本地 assistant/reasoning/tool payload
- accumulator hot path 使用增量 buffer；完整 text 只在 `Snapshot()`、`GetAccumulator`、terminal/status flush 时 materialize。
- accumulator 文件写入必须节流，terminal/finalize/stop 前强制 flush。
- tool args 必须写入 AG-UI `TOOL_CALL_ARGS.delta` 的 JSON-encoded string；CLI 只有摘要时使用 `{"summary": ...}` 包装
- usage 只有拿到稳定 provider identity 后才投影为 `CUSTOM name=run.llm_usage` 或 `CUSTOM name=run.turn_usage`

## CLI Mainline

当前 known CLI 主线：

- `codex`
  - raw mode: `codex exec --json`
- `claude-code`
  - raw mode: `claude -p --output-format stream-json --verbose --include-partial-messages`
- `gemini-cli`
  - raw mode: `gemini --prompt ... --output-format stream-json`
- `qwen-cli`
  - raw mode: `qwen -o stream-json --include-partial-messages --chat-recording`

规则：

- `deploy/agents/*/entrypoint.sh` 必须切到稳定 structured streaming mode
- `qwen-cli` parser 优先消费 `thinking_delta`；如果上游 provider 把 thought 内联到 `text_delta` / `result` 的 `<think>...</think>`，parser 仍要归一化成 `reasoning` 与 `assistant`
- parser bundle 保持 small-state parser 设计，不恢复大 wrapper
- `cli_id` 是 parser dispatch key；v1 不额外引入 declarative parser schema

## Stop Path

`Stop` 主线：

```text
runtime Stop request
  -> CLIOutputSidecar.Stop
  -> write stop.json marker
  -> main container watcher sees stop marker
  -> main container sends SIGINT/SIGTERM to CLI child
  -> child exits
  -> main container writes terminal.json
```

规则：

- sidecar 不直接做 parent-process ownership
- 主容器仍然 owns child process lifecycle
- force stop 只改变主容器转发的 signal 等级

## Code Layout

- `deploy/agents/sidecars/cli-output`
  - owns sidecar image、FIFO/UDS bootstrap、gRPC server、accumulator、parser registry、JetStream publisher
- `deploy/agents/common/cli-output-runtime.sh`
  - owns main container 的 FIFO wait、stop watcher、terminal.json write
