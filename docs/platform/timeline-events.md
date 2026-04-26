# Timeline Events

这份文档定义 timeline event stream 与 metrics projection 的基础设施边界。

## 职责

这组抽象负责：

- 发布 `StageInterval` 与 `TimelineEvent`
- 为 session / turn timeline 提供 retained replay carrier
- 将 timeline record 投影到低基数 metrics

## Ownership

- `AgentSession`、`AgentSessionAction`、`AgentRun` 的 repo 当前态是业务真相。
- `TimelinePublisher` 负责发布 timeline record；当前实现落在 `NATS JetStream`。
- `TimelineMetricsProjector` 负责低基数 metrics projection；当前实现落在 `Prometheus`。

## Key Types

### TimelineScopeRef

表示一条 timeline record 所属的业务 scope。

最小字段：

- `Scope`
  作用：标识 `session` 或 `turn`。
- `SessionID`
  作用：标识所属 `AgentSession`。
- `TurnID`
  作用：当 `Scope=turn` 时标识所属 `Turn`。

规则：

- `session` scope 必须有 `SessionID`，且不要求 `TurnID`。
- `turn` scope 必须同时有 `SessionID` 与 `TurnID`。

### StageInterval

表示某个 scope 上一个有开始/结束边界的阶段区间。

最小字段：

- `ScopeRef`
- `Stage`
- `Subject`
- `Action`
- `Status`
- `StartedAt`
- `EndedAt`
- `Attributes`

### TimelineEvent

表示某个 scope 上一个瞬时发生的稳定事件。

最小字段：

- `ScopeRef`
- `EventType`
- `Subject`
- `Action`
- `OccurredAt`
- `Attributes`

## Interfaces

### TimelinePublisher

方法：

- `PublishStageInterval(interval)`
  作用：向 retained event bus 发布一条阶段区间记录。
- `PublishEvent(event)`
  作用：向 retained event bus 发布一条瞬时事件记录。

规则：

- consumer 必须按 at-least-once / possible duplicate 语义处理。
- replay 应基于 retained stream 或 consumer checkpoint，不依赖 `Prometheus`。

### TimelineMetricsProjector

方法：

- `ObserveStageInterval(interval)`
  作用：将一个阶段区间投影到 metrics。
- `ObserveEvent(event)`
  作用：将一个瞬时事件投影到 metrics。

规则：

- metrics projection 不承担 timeline history。
- 高基数 ID 不进入 metrics label。
