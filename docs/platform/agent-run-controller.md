# AgentRun Controller

这份文档定义 `AgentRun` controller 抽象。

## 职责

`AgentRun` controller 负责收敛 `AgentRunResource` 的 execution summary status。

它负责：

- 校验 `AgentRunResource.spec.run` 基本完整性
- 维护 `AgentRun` 对应的 execution workload desired child
- 在 `spec.run.cancel_requested=true` 时停止当前 workload
- 用 execution workload observed state 推进 `AgentRunResource.status`
- 维护 `Accepted`、`WorkloadReady`、`Completed` condition
- 在 run 生命周期推进时生成 session-scope timeline event 与 stage interval

它不负责：

- 生成 `TurnOutput`
- 持有 turn-scope history / replay 真相

## Runtime Boundary

当前 execution runtime 由 `WorkflowRuntime` 抽象承载，默认实现为 Temporal workflow + Kubernetes Job activity。

规则：

- `AgentRun` 是 domain summary truth。
- Temporal workflow 是 durable execution adapter，不是业务真源。
- controller 在 `SCHEDULED` / `RUNNING` 阶段主动轮询 `WorkflowRuntime`，不依赖 child Job watch 作为唯一推进源。
- `AgentRun` cancel 通过 Temporal cancellation 推进 execution workflow。
- per-run cleanup 由 Temporal workflow 的 cleanup activity 调用 runtime service 完成。
- `AgentRun` controller 只依赖 `WorkflowRuntime`，不向 domain API 暴露 Temporal 或 Job schema。

## 状态规则

`AgentRun` controller 负责以下状态主链：

- `PENDING`
  作用：run desired state 已被平台接受，等待 workload create。
- `SCHEDULED`
  作用：execution workload 已提交。
- `RUNNING`
  作用：execution workload 已开始执行。
- `SUCCEEDED`
  作用：execution workload 已成功完成。
- `FAILED`
  作用：run desired state 非法，或 execution workload 失败完成。
- `CANCELED`
  作用：execution workload 已取消。

规则：

- `PENDING -> SCHEDULED -> RUNNING -> terminal` 是主链。
- workflow execution 丢失时，controller 重新提交 desired workflow，而不是把 `AgentRun` 当作唯一驱动点外泄给外部调用方。
- 但当 `spec.run.cancel_requested=true` 时，workflow execution 丢失必须收敛为 `CANCELED`，不能重提 workload。

## Conditions

`AgentRun` controller 维护：

- `Accepted=True`
  作用：run desired state 已被平台接受。
- `Accepted=False`
  作用：run desired state 非法，不能进入后续 execution 主链。
- `WorkloadReady=True`
  作用：execution workload 已创建并进入 execution 主链。
- `Completed=True`
  作用：run 已到达 terminal result。

## Timeline

`AgentRun` controller 写入 session-scope timeline：

- `SUBMITTED + run + reconcile`
  作用：`AgentRun` 首次被平台接受。
- `STARTED + run + workflow`
  作用：execution workload 首次进入 running。
- `FINISHED + run + workflow`
  作用：execution workload 到达 terminal result。

同时写入一条 terminal `StageInterval`：

- `EXECUTE + run + workflow`
  作用：记录 workload execution duration。

原因：

- `AgentRun` 当前不直接持有 `TurnID`
- turn-scope timeline 仍由用户层 `Turn` / projection path 持有
- `AgentRun` controller 负责内部 run lifecycle 的 session-level 可观测性
