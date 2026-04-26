# AgentSession Observability

这份文档定义 `AgentSession` / `Turn` / `AgentRun` 的观测抽象。

## 主链

```text
Timeline
  -> StageInterval
  -> TimelineEvent

Timeline
  -> EventBus projection
  -> SSE projection
  -> Prometheus projection
```

## 职责

这组抽象负责表达：

- session 各阶段 timeline
- turn 各阶段 timeline
- 从 timeline 派生出的 duration
- 面向用户的实时事件投影
- 面向运营与告警的 metrics 投影

它不负责表达：

- `TurnOutput` 的最终结果消息真相
- resource status 主路径
- 高频 token delta 或 heartbeat log

## 真源

观测不额外维护第二套 repo 真相；当前 execution 主链只保存资源当前状态。

规则：

- duration 不是独立真源。
- duration 是从 `StageInterval` 派生出的视图。
- `AgentSession`、`AgentSessionAction`、`AgentRun` 的 repo 当前态是业务真相。
- timeline history / replay 当前由 `EventBus` retention 承载；当前实现使用 `NATS JetStream`。
- `Prometheus` metrics 是从 `Timeline` 聚合出的投影。
- `EventBus` 是 `Timeline` 的实时与历史载体。
- `SSE` 是 `Timeline` 的实时投影。

## Timeline

`Timeline` 是某个 domain scope 的有序观测记录。

当前 scope：

- `session`
- `turn`

`Timeline` 由两类记录组成：

- `StageInterval`
- `TimelineEvent`

## StageInterval

`StageInterval` 表示一个具有开始和结束边界的阶段。

最小字段：

- `Scope`
  作用：标识这是 `session` 还是 `turn` 级阶段。
- `Stage`
  作用：标识生命周期阶段稳定枚举。
- `Subject`
  作用：标识当前阶段处理或观测的对象类型。
- `Action`
  作用：标识当前阶段对该对象执行的稳定操作语义。
- `StartedAt`
  作用：阶段开始时间。
- `EndedAt`
  作用：阶段结束时间。
- `Status`
  作用：阶段完成状态。
- `Attributes`
  作用：阶段附加属性。

规则：

- `StageInterval` 是阶段耗时的唯一真源。
- duration 由 `EndedAt - StartedAt` 派生得到。
- `Stage` 表达生命周期语义，必须保持稳定且低基数。
- `Subject` 表达被处理对象类型，使用稳定 machine value，不使用枚举。
- `Subject` 建议使用小写稳定字符串，例如 `endpoint`、`skill`、`mcp`、`lsp`。
- `Subject` 不承载实例 ID 或用户输入值；具体实例信息进入 `Attributes`。
- `Action` 表达对对象执行的稳定操作语义，使用小写 machine value，不使用枚举。
- `Action` 建议使用 `install`、`refresh`、`cleanup`、`load`、`reset`、`validate`、`resolve`、`project`、`persist` 等稳定动词。
- `Action` 不承载实现细节，不使用 `argo`、`pvc`、`postgres` 之类基础设施名称。
- 同一 scope 内，同一个 `Stage + Subject + Action` 在一次 timeline 中最多出现一次 active interval。

## Stage

`Stage` 使用稳定枚举，不把具体能力类型写进枚举值。

### SessionStage

- `BOOTSTRAP`
- `PREPARE`
- `READY`
- `RUN_ACTIVE`
- `FAILED`

### TurnStage

- `ACCEPT`
- `WAIT`
- `BIND_RUN`
- `QUEUE`
- `EXECUTE`
- `PROJECT`
- `PERSIST`
- `COMPLETE`

## StageStatus

`StageStatus` 使用稳定枚举：

- `ACTIVE`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`
- `SKIPPED`

## TimelineEvent

`TimelineEvent` 表示某个瞬时发生的稳定事件。

最小字段：

- `Scope`
  作用：标识这是 `session` 还是 `turn` 级事件。
- `EventType`
  作用：标识稳定事件枚举。
- `Subject`
  作用：标识当前事件关联的对象类型。
- `Action`
  作用：标识当前事件对应的稳定操作语义。
- `OccurredAt`
  作用：事件发生时间。
- `Attributes`
  作用：事件附加属性。

规则：

- `TimelineEvent` 表达关键时间点，不表达持续区间。
- `EventType` 不承载具体能力类型。
- `Subject` 是稳定查询维度，使用稳定 machine value，不使用枚举。
- `Subject` 建议使用小写稳定字符串，例如 `endpoint`、`skill`、`message`、`mcp`、`lsp`。
- `Subject` 不承载实例 ID 或用户输入值；具体实例信息进入 `Attributes`。
- `Action` 是稳定查询维度，使用小写 machine value，不使用枚举。
- `Action` 不承载实现细节。
- `TimelineEvent` 可以引用 message、tool、run 等细粒度对象，但这些引用不进入 Prometheus label。

## TimelineEventType

`TimelineEventType` 使用稳定枚举，不把具体能力类型写进枚举值。

- `CREATED`
- `READY`
- `SUBMITTED`
- `BOUND`
- `STARTED`
- `FIRST_RESULT_READY`
- `RESULT_COMMITTED`
- `FINISHED`
- `RELOADED`

## Session Timeline

`session` timeline 负责表达 session readiness 与 lifecycle 相关阶段。

示例 `Stage + Subject + Action`：

- `BOOTSTRAP + session + reconcile`
- `PREPARE + resource_config + materialize`
- `PREPARE + endpoint + refresh`
- `PREPARE + auth + refresh`
- `PREPARE + network_policy + refresh`
- `PREPARE + model_binding + resolve`
- `PREPARE + skill + refresh`
- `PREPARE + rule + refresh`
- `PREPARE + mcp + refresh`
- `PREPARE + instruction + refresh`
- `READY + session + reconcile`
- `RUN_ACTIVE + run + execute`
- `FAILED + session + reconcile`

示例 `EventType + Subject + Action`：

- `CREATED + session + reconcile`
- `READY + session + reconcile`
- `RELOADED + endpoint + refresh`
- `RELOADED + skill + refresh`
- `RELOADED + mcp + refresh`
- `FINISHED + session + reconcile`

## Turn Timeline

`turn` timeline 负责表达一次用户输入从提交到完成的全过程。

示例 `Stage + Subject + Action`：

- `ACCEPT + turn + reconcile`
- `WAIT + session_ready + reconcile`
- `BIND_RUN + run + reconcile`
- `QUEUE + run + reconcile`
- `EXECUTE + run + execute`
- `PROJECT + message + project`
- `PROJECT + tool_summary + project`
- `PROJECT + usage_summary + project`
- `PERSIST + message + persist`
- `PERSIST + metric + persist`
- `COMPLETE + turn + reconcile`

示例 `EventType + Subject + Action`：

- `SUBMITTED + turn + reconcile`
- `BOUND + run + reconcile`
- `STARTED + run + execute`
- `FIRST_RESULT_READY + message + project`
- `RESULT_COMMITTED + message + persist`
- `RESULT_COMMITTED + tool_summary + persist`
- `RESULT_COMMITTED + usage_summary + persist`
- `FINISHED + run + execute`

## Duration

duration 不是单独存储对象。

规则：

- session 各阶段耗时来自 `session` `StageInterval`
- turn 各阶段耗时来自 `turn` `StageInterval`
- message 首次可见耗时等派生指标，来自 `TimelineEvent` 与 `StageInterval` 的组合计算

## SSE Projection

`SSE` 提供 `Timeline` 的实时投影。

职责：

- 向用户实时发送阶段开始/结束
- 向用户实时发送关键事件
- 提供 message ready、阶段耗时、排队时间、执行时间等观测信息

规则：

- `SSE` 可以携带 `session_id`、`turn_id`、`run_id`、`message_id`
- `SSE` 发送的是 timeline projection，不是新的业务真相
- `SSE` 可以发送实时派生 duration，但其来源仍然是 `Timeline`
- `Subject` 与 `Action` 应作为事件筛选与查询维度暴露给用户侧

## EventBus Projection

`EventBus` 提供 `Timeline` 的异步实时投影。

当前 implementation 选择 `NATS JetStream`。

规则：

- `EventBus` 不保存 domain current truth。
- `EventBus` retention 承载 timeline history / replay。
- `EventBus` 事件重放不改变 `Turn`、`AgentSessionAction`、`AgentRun` 的调度真相。
- `SSE` 可以订阅 `EventBus` projection；断线恢复也应以 retained event stream 或 consumer checkpoint 为准。

## Prometheus Projection

`Prometheus` 提供 `Timeline` 的聚合 metrics 投影。

职责：

- 提供 session/turn 阶段耗时 histogram
- 提供事件计数器
- 提供在途数量等低基数 gauge

规则：

- `Prometheus` 只接收低基数投影
- `session_id`、`turn_id`、`run_id`、`message_id` 不进入 label
- duration metrics 来源于 `StageInterval`
- event counters 来源于 `TimelineEvent`
- `Subject` 只有在保持低基数时才能进入 label；否则必须先归一化或省略
- `Subject` 在观测存储中应保持可筛选维度语义，而不是仅作为展示文本
- `Action` 只有在保持低基数时才能进入 label；否则必须先归一化或省略

## 与 Resource Status 的边界

- `AgentSessionStatus` 与 `AgentRunStatus` 只保存 summary state。
- `Timeline` 不进入 resource status 主路径。
- 高频 timeline、message 级事件、阶段耗时明细应走专用 observability path。

## 与 TurnOutput 的边界

- `TurnOutput` 保存最终 result projection。
- `Timeline` 保存观测事件流。
- `TurnOutput` 不保存完整 timeline。
- `TurnOutput.UsageSummary` 可以来自 timeline 聚合结果，但不替代 retained event stream。
