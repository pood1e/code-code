# AgentSession Reconciliation

这份文档定义 `AgentSession` reconciliation 抽象。

## 职责

`AgentSession` reconciliation 负责收敛 AgentSession state 的 session-level readiness 与 status。

它负责：

- 读取 AgentSession desired state
- 校验 workspace、warm state、runtime config、resource config 是否可用于后续 turn
- 写入 AgentSession status
- 维护 `WorkspaceReady`、`WarmStateReady`、`RuntimeConfigReady`、`ResourceConfigReady`、`ReadyForNextRun`
- 在没有 active run 时把 ready session 标记为可接受下一次 run
- 只在 status 语义变化时写入 status，避免由时间戳造成 reconcile 抖动

它不负责：

- 用户层 `Chat` 生命周期
- 用户层 `Turn` 持久化
- `AgentSessionAction` 排队选择
- `AgentRun` 创建
- Temporal workflow 提交或观察

## 状态规则

`AgentSession` reconciliation 使用 AgentSession status phase 表达 session summary state。

- `PENDING` 表示 session 尚未满足后续 turn 的执行前提。
- `READY` 表示 session 已满足后续 turn 的执行前提，且没有 active run。
- `RUNNING` 表示 session 当前存在 active run。
- `FAILED` 表示 session desired state 无法被 controller 解释或准备。

## Readiness

`ReadyForNextRun=True` 的前提是：

- `WorkspaceReady=True`
- `WarmStateReady=True`
- `RuntimeConfigReady=True`
- `ResourceConfigReady=True`
- 当前没有 active run

本 reconciliation 由 domain event consumer 触发，通过 `AgentRun`、registered CLI catalogs、`ProviderSurfaceBinding`、`CredentialDefinition` 与 credential Secret 变更刷新 readiness 投影。会触发实际 state mutation 的动作仍由 `AgentSessionAction` 串行域承载。

当 `spec.resource_config` 的局部 revision 变化时，controller 会自动 ensure：

- `reload_subject(rule)`
- `reload_subject(skill)`
- `reload_subject(mcp)`

用户显式触发的 force reload 使用 `reload_subject(resource_config)`，不由本 controller 自动创建。

## Generation

`observedGeneration` 表示 reconciliation 已观察到的 AgentSession generation。

`runtimeConfigGeneration`、`resourceConfigGeneration`、`stateGeneration` 只在对应 readiness 为 `True` 时推进到当前 `metadata.generation`；当对应 readiness 为 `False` 时保留上一轮 status 值。

`lastTransitionTime` 只在 condition status 变化时更新。`updatedAt` 只在 status 语义变化时更新。
