# AgentRun

这份文档定义 `AgentRun` 的平台抽象。

跨语言 data model 由 `packages/go-contract/platform/agent_run/v1` 提供。
condition vocabulary 见 [agent-run-conditions.md](./agent-run-conditions.md)。

`AgentRun` 是平台内部 turn execution record，不是用户直接 CRUD 的产品对象。
用户层关系见 [agent-session-chat-view.md](./agent-session-chat-view.md)。

## 模型图

```text
AgentRunSpec
  -> RunID
  -> SessionID
  -> SessionGeneration
  -> RuntimeConfigGeneration
  -> ResourceConfigGeneration
  -> StateGeneration
  -> ProviderID
  -> ExecutionClass
  -> ContainerImage
  -> CPURequest
  -> MemoryRequest
  -> AuthRequirement
  -> Request
  -> CancelRequested
  -> PrepareJobs

AgentRunRef
  -> RunID

AgentRunState
  -> Generation
  -> Spec
  -> Status

AgentRunStatus
  -> RunID
  -> Phase
  -> ObservedGeneration
  -> Message
  -> WorkloadID
  -> Conditions
  -> Result
  -> UpdatedAt
  -> PrepareJobs

AgentRunResource.status
  -> resultSummary

AgentRunCondition
  -> Type
  -> Status
  -> Reason
  -> Message
  -> ObservedGeneration
  -> LastTransitionTime
```


## 职责

`AgentRun` 负责表达：

- 一个 `AgentSession` 内一次 turn 的 desired state
- 一个 turn 的 observed summary state
- desired state 与 observed state 的 generation 对齐关系

## AgentRunSpec

- `RunID`
  作用：标识一次 turn desired state。
- `SessionID`
  作用：标识所属 `AgentSession`。
- `SessionGeneration`
  作用：冻结本次 turn 启动时的 session generation。
- `RuntimeConfigGeneration`
  作用：冻结本次 turn 启动时的 runtime config generation。
- `ResourceConfigGeneration`
  作用：冻结本次 turn 启动时的 resource config generation。
- `StateGeneration`
  作用：冻结本次 turn 启动时使用的 warm state generation。
- `ProviderID`
  作用：冻结本次 turn 绑定的 CLI / provider identity。
- `ExecutionClass`
  作用：冻结本次 turn 解析出的 execution class。
- `ContainerImage`
  作用：冻结本次 turn 使用的具体 CLI image。
- `CPURequest`
  作用：冻结本次 turn 使用的 CPU request。
- `MemoryRequest`
  作用：冻结本次 turn 使用的 memory request。
- `Request`
  作用：本次 turn 的 provider-facing run request。
- `AuthRequirement`
  作用：冻结本次 turn 的 provider-visible auth requirement。
- `CancelRequested`
  作用：表达用户已请求停止当前 run。
- `PrepareJobs`
  作用：冻结本次 run 在 execute 前需要编排的 session prepare jobs。

规则：

- `AgentRun` 不持有 session-level runtime config。
- `AgentRun` 不持有 session-level resource config。
- `AgentRun` 必须持有 submit-time resolved execution image 与 resource requests。
- `AgentRun` 必须持有 submit-time frozen `ProviderID`，供 execution adapter 选择 CLI-specific runtime wiring。
- `AgentRun` 必须持有 submit-time frozen `AuthRequirement`，供 prepare job 构造 runtime auth files 与 run-scoped auth projection。
- `AgentRunAuthRequirement.RuntimeURL` 是本次 run 的 provider-facing base URL。
- `AgentRunAuthRequirement.MaterializationKey` 是 CLI auth bootstrap key，来自 CLI specialization package 的 auth materialization contract。
- `AgentRunPrepareJob.CliID` 指向解释这个 prepare job 的 CLI。
- `AgentRunPrepareJob.JobType` 是 CLI-scoped prepare job registry key，由 session 内对应 CLI YAML 解释。
- `AgentRunPrepareJob.ParametersYaml` 是本次 job 的 CLI-owned YAML 参数片段，core model 不解析字段形状。
- `AgentRunPrepareJob.RunType` 表达 prepare job 执行策略：`Init`、`PerRun`、`OnChanged`。
- `AgentRunPrepareJob.Cleanup` 表达 prepare job 是否需要 terminal cleanup。
- 多个 prepare job 来自 `AgentSessionSpec.prepare_jobs`，并在 turn 接受时冻结到本次 run。
- 如果 session 未提供 `auth` job，平台追加 run-scoped auth prepare job。
- 多个 prepare job 由 Temporal execution adapter 编排为独立 Kubernetes Job。
- prepare job observed status 从 execution workflow 投影到 `AgentRunStatus.PrepareJobs`，只保留 summary fields。
- session config 更新只影响后续 turn，不影响当前 running turn。
- `CancelRequested` 是 run cancel 的唯一 desired truth。
- `AgentRun` 不反向引用用户层 `Turn`。

## AgentRunRef

- `RunID`
  作用：标识一次已创建的 turn。

## AgentRunState

- `Generation`
  作用：标识当前 turn desired state generation。
- `Spec`
  作用：保存 turn desired state。
- `Status`
  作用：保存 turn observed state。

规则：

- `AgentRunState` 不再重复保存独立 `RunID`；identity 由 `Spec.RunID` 与 `Status.RunID` 承载。

## AgentRunStatus

- `RunID`
  作用：关联对应 `AgentRunSpec`。
- `Phase`
  作用：表达 turn 当前生命周期阶段。
- `ObservedGeneration`
  作用：标识当前 status 对应的 turn desired state generation。
- `Message`
  作用：保存当前状态说明。
- `WorkloadID`
  作用：引用承载本次 turn 的 runtime workload 的 opaque ID。
- `Conditions`
  作用：表达 turn 当前条件集合。
- `Result`
  作用：表达完成后的 terminal result summary；完整用户可见结果由 `TurnOutput` 承载。
- `UpdatedAt`
  作用：记录 status 更新时间。
- `PrepareJobs`
  作用：保存 prepare job-level observed summary。

规则：

- `PrepareJobs` 不保存 Temporal history 或 Kubernetes Job schema，只保存 `job_id`、phase、message、started/finished time。

`Phase` 取值：

- `Pending`
  作用：turn desired state 已保存，等待 reconcile。
- `Scheduled`
  作用：turn workload 已提交。
- `Running`
  作用：turn 正在执行。
- `Succeeded`
  作用：turn 已成功完成。
- `Failed`
  作用：turn 已失败完成。
- `Canceled`
  作用：turn 已取消。

## AgentRunCondition

- `Type`
  作用：标识 condition 类型。
- `Status`
  作用：标识 condition 当前真值状态。
- `Reason`
  作用：标识 condition 最近一次状态变化原因。
- `Message`
  作用：保存 condition 的可读说明。
- `ObservedGeneration`
  作用：标识这个 condition 对应的 desired state generation。
- `LastTransitionTime`
  作用：记录这个 condition 最近一次状态切换时间。


## Kubernetes Target

在 Kubernetes execution plane 上，`AgentRun` 的目标语义如下。

### 主链

```text
Platform API
  -> AgentSession
  -> AgentRunCreator
  -> AgentRun resource create
  -> controller reconcile
  -> WorkflowRuntime submit/get
  -> status subresource update
```

### 目标映射

- `AgentRunCreator.CreateRun`
  作用：映射到一次 turn record create。
- `AgentRunReconciler.ReconcileRun`
  作用：映射到 turn execution controller reconcile loop。
- `WorkflowRuntime.Submit`
  作用：启动 backing Temporal workflow。
- `WorkflowRuntime.Get`
  作用：映射到 backing execution workload observed state read。
- `AgentRunReader.Get`
  作用：映射到 resource read。
- `AgentRunStatusWriter.UpdateStatus`
  作用：映射到 status subresource update。

### Workflow 编排

`AgentRun` controller 为每个 run 启动一个 deterministic Temporal workflow：

```text
prepare-job-* -> execute -> cleanup
```

规则：

- workflow id 等于 `AgentRunResource.metadata.name`，重复提交按 existing workflow 幂等处理。
- `prepare-job-*` 由 `AgentRunSpec.prepare_jobs[]` 动态展开。
- 每个 prepare step 默认调用 `platform-agent-runtime-service` HTTP action，由 runtime service 决定是否创建挂载 PVC 的 Kubernetes `Job`。
- `execute` 使用 `AgentRunSpec.container_image`，命令固定为 `/usr/local/bin/agent-entrypoint.sh`。
- prepare job 的容器实现由同一个 CLI image 承载，命令固定为 `/usr/local/bin/agent-prepare.sh`。
- `onExit` 调用 runtime service cleanup action，只处理 `cleanup=true` 的 prepare job。
- session workspace/home-state PVC 仍由 `AgentSession` carrier 管理，workflow 只挂载既有 PVC。
- browser-facing workflow progress 通过 AG-UI `ACTIVITY_SNAPSHOT activityType=TURN` 投影为 `steps[]`。

### Generation 规则

- `metadata.generation`
  作用：表达 spec 变更代数。
- `status.observedGeneration`
  作用：表达 controller 已处理到的 spec generation。
- `metadata.resourceVersion`
  作用：表达并发控制版本；不替代 `generation` 或 `observedGeneration`。

### Status 裁剪规则

`status` 只承载 summary state。

`AgentRunResource.status.resultSummary` 只保存：

- terminal status
- error code
- error message
- retryable flag

不进入 `status` 主路径的内容：

- ordered output stream
- 长文本 message/reasoning
- 高频 usage timeline
- 大体积 tool transcript

这些内容应走更适合的输出承载面，例如日志、对象存储或单独 output channel。
