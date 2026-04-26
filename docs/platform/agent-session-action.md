# AgentSession Action

## responsibility

`AgentSessionAction` 是 `AgentSession` 串行域里的 durable action。

当前主线只实现三类动作：

- `run_turn`
- `reload_subject(rule|skill|mcp|resource_config)`
- `reset_warm_state`

## fields

- `action_id`
  作用：标识一次稳定动作。
- `session_id`
  作用：标识所属 `AgentSession`。
- `type`
  作用：标识动作类型。
- `turn_id`
  作用：可选关联的用户层 turn。
- `run`
  作用：`run_turn` 当前或最后一次内部 `AgentRun`。
- `input_snapshot`
  作用：保存动作执行所需的冻结输入。
- `stop_requested`
  作用：表达用户已请求停止后续 attempt。
- `failure_class`
  作用：表达当前失败/等待属于 `blocked`、`transient`、`permanent` 还是 `manual_retry`。
- `retry_count`
  作用：记录 controller 已为这次 action 消耗的自动重试次数。
- `next_retry_at`
  作用：记录下一次自动重试的计划时间。
- `attempt_count`
  作用：记录这次 action 已经启动过多少次内部 run attempt。
- `candidate_index`
  作用：记录当前或下一次 attempt 使用的 frozen runtime candidate 下标。
- `view.display_phase`
  作用：提供面向上游和用户层投影的最小展示状态。
- `view.can_stop`
  作用：表达当前 action 是否还能接受 `Stop`。
- `view.can_retry`
  作用：表达当前 action 是否还能接受用户侧 `Retry`。

## run_turn

`run_turn` 在接受时冻结完整执行输入：

- `run_request`
- `session_generation`
- `runtime_config_generation`
- `resource_config_generation`
- `state_generation`
- `provider_id`
- `execution_class`
- `container_image`
- `cpu_request`
- `memory_request`
- `auth_requirement`
- `runtime_candidates[]`

`run_turn` 只从这份 snapshot 创建 `AgentRun`。

`runtime_candidates[]` 是 ordered resolved runtime chain：

- 第一个 entry 是当前 primary candidate
- 后续 entries 是 session runtime fallback chain 的 resolved candidates

每个 candidate 固定包含：

- `resolved_provider_model`
- `auth_requirement`

规则：

- `run_request.resolved_provider_model` 必须在 action 接受时由 backend 写成 primary candidate。
- 当前 `AgentRun` 只消费 `runtime_candidates[candidate_index]`。
- 一个 `run_turn` action 可以因为 automatic retry / fallback 产生多次内部 `AgentRun` attempt。
- `status.run` 只指向当前或最后一次内部 run，不承担历史 attempt 列表。
- 后续自动 fallback 只能在同一个 frozen `runtime_candidates[]` 内前进，不能重新解析 live session/profile。

## reload_subject(rule|skill|mcp)

`reload_subject(rule|skill|mcp)` 表示把当前 session 的局部 `resource_config` realize 到 session 串行域。

snapshot 固定包含：

- `session_generation`
- `subject`
- `snapshot_id`
- `subject_revision`
- `resource_config`

规则：

- action 只对创建时冻结的 `subject + subject_revision` 负责。
- rule / skill / mcp 的 source 版本变化会先投影到 session `spec.resource_config`，再由 session controller 自动 ensure 对应 subject action。
- 自动 ensure 的 action 只覆盖 drift 的 subject；没有 drift 的 subject 不会重复 reload。
- 若 session 后续已经切到新的 `resource_config`，旧 action 必须收敛为 `Canceled`，不能把 realize 结果写回旧版本。
- `ResourceConfigReady=True` 的真相是：
  - `status.realized_rule_revision == desired rule revision`
  - `status.realized_skill_revision == desired skill revision`
  - `status.realized_mcp_revision == desired mcp revision`

## reload_subject(resource_config)

`reload_subject(resource_config)` 是用户显式触发的一次 force reload。

规则：

- 它冻结整份 `resource_config`，并一次性重做 rule / skill / mcp 的 realize。
- 它不依赖局部 drift；即使当前 revision 已一致，也可以执行一次强制重载。
- controller 不会因为普通 drift 自动创建这种 action；自动路径只创建局部 subject action。

## reset_warm_state

`reset_warm_state` 表示把 session 的 warm-state carrier 切到一个新的 `home_state_id`。

snapshot 固定包含：

- `session_generation`
- `source_home_state_id`
- `target_home_state_id`

规则：

- `ResetAgentSessionWarmState` 是唯一创建入口。
- 同一个 session 同时最多一个 nonterminal `reset_warm_state` action。
- action 执行时只负责把 `spec.home_state_ref.home_state_id` 切到 `target_home_state_id`。
- `AgentSession` controller 负责 ensure 新 carrier、等待其 `Bound`、推进 `observed_home_state_id` 和 `state_generation`。
- 只要存在 nonterminal `reset_warm_state` action，新 `run_turn` 就不得接受。

## implementation

- `AgentSession` controller 负责在 `resource_config` drift 时 ensure `reload_subject(rule|skill|mcp)` action。
- `AgentSessionAction` controller 负责推进 action，并在成功时写回：
  - `status.realized_rule_revision`
  - `status.realized_skill_revision`
  - `status.realized_mcp_revision`
- `AgentSession` controller 在全部 subject revision 都已 realize 后推进：
  - `status.resource_config_generation`
- `run_turn` 继续通过 action queue 串行推进；新 turn 的接受 gate 依赖 `ReadyForNextRun`。
- `reset_warm_state` 在串行域里和 `run_turn` / `reload_subject` 共享同一个 queue owner。
- `StopAgentSessionAction` 只负责停止后续 attempt：
  - pending action 直接收敛为 `Canceled`
  - running action 通过 `AgentRun.spec.cancel_requested=true` 请求停止当前 attempt，并阻止后续 retry
- `RetryAgentSessionAction` 只对 terminal `run_turn` 生效：
  - 复用 source action 的 `run_request`
  - 按当前 `AgentSession` 配置重新接受一条新的 `run_turn` action
- 自动 retry 当前只覆盖 action 的 transient pre-terminal 失败：
  - queue / dependency blocked -> `phase=Pending` + `failure_class=blocked`
  - transient dispatch / status-write failure -> `phase=Pending` + `failure_class=transient` + exponential backoff
  - retry budget exhausted -> `phase=Failed`
- 自动 retry 的 `max_retries/base_backoff/max_backoff` 默认由 controller 内置策略提供，并支持在 session runtime 装配时注入覆盖。
- `run_turn` 对应的 terminal `AgentRun` 若返回 `retryable=true`：
  - 先消耗当前 frozen runtime candidate 的 automatic retry budget
  - 当前 candidate budget 用尽后，再推进到下一个 frozen candidate
  - 所有 candidate 都耗尽后，才收敛为 `phase=Failed` + `failure_class=manual_retry`
- provider/model fallback 的扩展点固定在 `run_turn` 接受时冻结 ordered candidate chain；在该 snapshot 契约落地前，controller 不做运行时 fallback 漂移解析。
- `view.display_phase` 只收口用户最常见的简单状态：
  - `queued`
  - `retrying`
  - `fallbacking`
  - `running`
  - `stopping`
  - `stopped`
  - `succeeded`
  - `failed`
- `status.phase`、`failure_class`、`stop_requested`、`next_retry_at` 继续保留 control-plane 真相；`view` 只是稳定投影，不替代底层状态机。
