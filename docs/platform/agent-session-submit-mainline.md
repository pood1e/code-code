# AgentSession Submit Mainline

## responsibility

定义当前 `CreateAgentSessionAction` 作为 `AgentSession` 内部 submit mainline 的稳定语义。

## key fields and methods

- `CreateAgentSessionAction`
  作用：提交一次 session-scoped durable action。
- `GetAgentSessionAction`
  作用：读取 action summary state 与关联 `run`。
- `GetAgentRun`
  作用：读取 run summary state 与最终结果摘要。
- `AgentSessionAction.status.runId`
  作用：表达该 action 当前或最后一次内部 `AgentRun`。
- `AgentSessionAction.status.attemptCount`
  作用：表达该 action 已启动的内部 run attempt 数量。
- `AgentSessionAction.status.candidateIndex`
  作用：表达该 action 当前或下一次 attempt 使用的 frozen runtime candidate 下标。
- `AgentSession.status.activeRunId`
  作用：表达当前 session active slot。
- `AgentRun.status.resultSummary`
  作用：保存一次 run 的 terminal 摘要，仅用于 retry/fallback 与状态展示。
- run result projector
  作用：消费 NATS terminal result event 并写入一次 run 的最终 `RunResult`。

## implementation notes

- `CreateAgentSessionAction` 主链固定为：校验请求、按当前 session 冻结完整 `run_turn` snapshot、持久化 `AgentSessionAction(type=RUN_TURN)`、由 controller 选择队头 action、在 dispatch gate 满足时创建 `AgentRun`。
- `run_turn` snapshot 必须冻结 ordered runtime candidates：
  - primary candidate 来自当前 `runtime_config.provider_surface_binding_ref` 与 submit-time model resolution
  - fallback candidates 来自当前 `runtime_config.fallbacks[]`
  - `RunRequest.resolved_provider_model` 必须写成 primary candidate
- `run_turn` automatic fallback 主链固定为：
  - 当前 candidate 对应 `AgentRun` terminal `result.retryable=true`
  - 先消耗当前 candidate 的 automatic retry budget
  - 当前 candidate budget 耗尽后，action 才推进到下一个 frozen `candidate_index`
  - action 清空当前 `runId`
  - controller 为新的 candidate 创建新的内部 `AgentRun`
- `activeRunId` owner 固定为：
  - action dispatch path claim
  - `AgentRun` terminal reconcile release
  - `AgentSession` reconcile self-heal stale slot
- durable queue 真相固定在 `AgentSessionAction`；`AgentRun` 只表示已经开始的一次 execution。
- `AgentSession` readiness 需要 live 校验下一次 run 的 runtime dependency，至少包括：
  - `provider_surface_binding_ref`
  - `provider credential`
  - `provider_id + execution_class`
- `cli-output-sidecar` 在 terminal 时发布 JetStream terminal event；runtime service 的 NATS projector 写入 `AgentRun.status.resultSummary`。
- 阶段事件真相固定为 durable MQ stream；`AgentSession.status` 与 `AgentRun.status` 只保存当前态，不保存完整历史事件。
- Prometheus 只消费事件做 metrics projection，不承担 replay。
- `AgentRun` status reconcile 只推进 phase、conditions、workload summary；不得覆盖已持久化的 terminal `resultSummary`。
