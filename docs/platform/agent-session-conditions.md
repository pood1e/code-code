# AgentSession Conditions

这份文档定义 `AgentSessionCondition` 的稳定 vocabulary。

Kubernetes `AgentSessionResource.status.session.conditions` 使用原生 `metav1.Condition` schema；proto `AgentSessionCondition` 保持同等语义用于跨语言 contract。

## Condition Types

- `WorkspaceReady`
  作用：session workspace 已准备好供后续 turn 使用。
- `WarmStateReady`
  作用：session home state 已准备好供后续 turn 使用。
- `RuntimeConfigReady`
  作用：runtime reload surface 已准备好供后续 turn 使用。
- `ResourceConfigReady`
  作用：resource reload surface 已准备好供后续 turn 使用。
- `ReadyForNextRun`
  作用：session 当前可接收下一次 turn。

规则：

- 同一个 `AgentSessionStatus` 中，同一种 `Type` 只能出现一次。
- `Status` 使用 Kubernetes condition 值：`True`、`False`、`Unknown`。
- `Reason` 必须是稳定 CamelCase category。
- `ObservedGeneration` 不能超过所属 `AgentSessionStatus.ObservedGeneration`。
- `LastTransitionTime` 只在 condition `Status` 变化时更新。

## Reasons

### WorkspaceReady

- `WorkspacePrepared`
- `WorkspaceUnavailable`

### WarmStateReady

- `WarmStatePrepared`
- `WarmStateReset`
- `WarmStateUnavailable`

### RuntimeConfigReady

- `RuntimeConfigPrepared`
- `RuntimeConfigInvalid`
- `RuntimeConfigRevoked`

### ResourceConfigReady

- `ResourceConfigPrepared`
- `ResourceConfigInvalid`
- `ResourceConfigIncompatible`

### ReadyForNextRun

- `Ready`
- `SessionNotReady`
- `ActiveRunInProgress`
- `SessionSuspended`
- `SessionClosed`

## Warm State Invalidation

`WarmStateReset` 表示平台判定既有热状态不能安全复用，并已切换到新的 `StateGeneration`。

触发场景包括：

- session 显式 reset
- provider 报告既有 state 不可恢复
- `ResourceConfig` 变化后，provider capability 不允许继续复用既有 state

这里的 capability 判断至少受以下字段约束：

- `Capabilities.Resume`
- `Capabilities.ResumeAfterInstructionChange`
- `Capabilities.ResumeAfterToolChange`

`WarmStateReset` 不要求关闭 session；它只表示下一次 turn 将从新的 warm state generation 启动。
