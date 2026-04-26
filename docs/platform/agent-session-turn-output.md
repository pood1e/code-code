# AgentSession Turn Output

这份文档定义用户层 `TurnOutput` 投影模型，以及它与 `agent.RunOutput` runtime output contract 的关系。

## 边界

`TurnOutput` 不是新的 runtime stream contract。

它负责表达：

- 一个 `Turn` 的最终 result-style output projection
- 用户层可见的最终消息集合
- 最终 tool summary 集合
- 最终 usage summary

它不负责表达：

- delta 型 output event
- reasoning / tool / usage 的增量轨迹
- 底层执行期的 event log
- session / turn 的完整 timeline
- 阶段耗时明细

## 与 RunOutput 的关系

`agent.RunOutput` 见 [../agent/output.md](../agent/output.md)。  
可复用消息 contract 见 [../agent/message.md](../agent/message.md)。

关系：

- `RunOutput` 是 runtime output contract
- `TurnOutput` 是从 `RunOutput` 投影出来的最终结果

规则：

- `TurnOutput.Messages` 直接复用 AG-UI `Message`
- `TurnOutput` 从 `RunOutput.event` 的 AG-UI stream 投影最终消息
- `TurnOutput` 不直接复用 streaming event
- `TurnOutput` 不保存 runtime stream item 序列

## Result-Only Rule

`TurnOutput` 只保存 result 型数据。

具体规则：

- `TEXT_MESSAGE_CONTENT` 不作为独立消息落盘到 `TurnOutput`
- `REASONING_MESSAGE_CONTENT` 不作为用户 transcript 消息落盘到 `TurnOutput`
- `TOOL_CALL_ARGS` 不作为独立消息落盘到 `TurnOutput`
- usage timeline 不落盘到 `TurnOutput`

持久化到 `TurnOutput` 的内容必须是最终投影结果。

## 模型图

```text
TurnOutput
  -> Messages
  -> ToolSummaries
  -> UsageSummary
```

## Messages

`Messages` 表示本轮最终消息集合。

职责：

- 承载最终结构化 `Message` 集合
- 承载本轮最终结构化消息切片

规则：

- 一次 `Turn` 可以产生多条最终 messages。
- 每条 message 直接复用 AG-UI `Message`。
- `Messages` 是 result projection，不是 delta log。
- `Chat` 的消息历史由多个 `TurnOutput.Messages` 按顺序拼接得到。

## ToolSummaries

`ToolSummaries` 表示本轮最终 tool 调用摘要集合。

职责：

- 承载用户层可见的 tool result summary
- 将 `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END` 或 `TOOL_CALL_CHUNK` 投影为 assistant message 的 `toolCalls`
- 将 `TOOL_CALL_RESULT` 投影为 AG-UI `tool` message，供 `MESSAGES_SNAPSHOT` 断线恢复

规则：

- 只保存最终摘要
- 不保存调用中间流式事件

## UsageSummary

`UsageSummary` 表示本轮最终 usage 汇总。

职责：

- 承载 turn 级 usage summary
- 为用户层摘要和运营统计提供统一结果语义

规则：

- 只保存 turn 级最终汇总
- 不保存逐请求 usage timeline

## Persistence Projection

`TurnOutput` 是 canonical result model，不直接绑定某个存储。

### Structured Message Projection

作用：

- 将 `TurnOutput.Messages` 投影为结构化消息记录
- 目标存储面：`Postgres`

规则：

- `Postgres` 保存最终结构化消息
- 不保存 delta 型消息事件
- `packages/session` 的 `TurnMessageRepository` 是结构化消息落点
- AG-UI 初始化和断线恢复通过 `MESSAGES_SNAPSHOT` 读取该投影

### Metric Projection

作用：

- 将 `TurnOutput.UsageSummary` 与 turn/runtime summary 投影为指标
- 目标存储面：`Prometheus`

规则：

- `Prometheus` 保存 metrics
- metrics projection 不承担结构化消息真相

## Ownership

- `TurnOutput` 是用户层 turn 的最终输出模型
- `AgentRun` / `RunOutput` 是内部 runtime output source
- `Postgres` 承载结构化消息 projection
- `Prometheus` 承载 metrics projection

## 规则

- `TurnOutput` 必须和存储实现解耦。
- `TurnOutput` 不直接等于数据库 schema。
- `TurnOutput` 不直接等于 metrics series shape。
- `RunOutput` 是 source；`TurnOutput` 是 result projection。
- timeline 与 duration metrics 见 [agent-session-observability.md](./agent-session-observability.md)。
