# Platform Control Plane Contract


这份文档定义 platform control plane 的核心抽象。

## 主链

```text
Platform API
  -> State Contracts
  -> AgentSessionCreator
  -> AgentSessionReconciler
  -> AgentSessionAction
  -> AgentRunCreator
  -> AgentRunReconciler
  -> TimelinePublisher
  -> TimelineMetricsProjector
  -> AgentSessionStatus
  -> AgentProfile
  -> WorkloadID
  -> AgentRunStatus
```

## 边界

platform control plane 负责：

- 保存 declarative desired state
- 提交 agent session desired state
- 提交 session 内一次 turn desired state
- 保存 agentSession 串行域内的 durable action
- 通过 reconciler 驱动 runtime workload
- 记录 session 与 turn observed status
- 发布 timeline 事件并生成实时/metrics 投影

state contract 见 [state-store.md](./state-store.md)。
`AgentSession` 见 [agent-session.md](./agent-session.md)。
`AgentSessionAction` 见 [agent-session-action.md](./agent-session-action.md)。
`AgentRun` 见 [agent-run.md](./agent-run.md)。
observability 见 [agent-session-observability.md](./agent-session-observability.md)。
`AgentRunCondition` vocabulary 见 [agent-run-conditions.md](./agent-run-conditions.md)。
`model discovery` implementation 主链见 [model-discovery.md](./model-discovery.md)。
`AgentProviderBinding` 见 [agent-provider-binding.md](./agent-provider-binding.md)。
`AgentProfile` 见 [agent-profile.md](./agent-profile.md)。

`LLMProviderSurface` 的 ownership 由 [../provider/model.md](../provider/model.md) 提供。  
provider / endpoint / model 的最终选择由 agent 侧完成，platform 只提供可用配置与 observed catalog。
credential、egress policy、model 的 runtime contract 分别直接复用各自 domain owner 的 contract。

## AgentSessionCreator

表示 agent session desired state 的提交入口。

方法：

- `CreateSession(spec)`
  作用：接受 `profile_ref` 或 inline `profile-shaped config`，创建 session desired state，并返回 `AgentSessionRef`。

当前 implementation mainline 先打通 internal data path：

- management API 直接接 self-contained `AgentSessionSpec`
- `profile_ref` / inline draft import 的最终用户层输入形态后续再补

## AgentSessionReconciler

表示 session desired state 到 session readiness 的收敛入口。

方法：

- `ReconcileSession(session_id)`
  作用：读取 `AgentSessionState`，刷新 session runtime/resource readiness，写回 `AgentSessionStatus`。

## AgentSessionAction

表示 agentSession 串行域内的一次 durable action。

职责：

- 保存 turn 输入被接受后的调度真相
- 保存 session reload 与 run 的调度真相
- 为同一 `agent_session_id` 提供统一排队入口

## AgentRunCreator

表示 session 内一次 selected action execution 的内部创建入口。

方法：

- `CreateRun(spec)`
  作用：校验一次 `AgentRunSpec`、保存 turn desired state，并返回 `AgentRunRef`。

当前 implementation mainline：

- `CreateAgentSessionAction` 只接 `session_id + action_id + turn_id + run_request`
- backend 先 durable 保存 `AgentSessionAction(type=RUN_TURN)`
- backend 在 action 接受时冻结完整 `run_turn` snapshot
- action controller 选择队头 action 后再调用 `CreateRun`
- `CreateRun` 直接消费 action snapshot 中已冻结的 generation、execution image/resources、auth input 与 `RunRequest`
- `MCP` / `Skill` / `Rule` 的 capability materialization 后续再接到这条 submit path

## AgentRunReconciler

表示 agent run desired state 到 runtime workload 的收敛入口。

方法：

- `ReconcileRun(run_id)`
  作用：读取 `AgentRunState`，通过 implementation-owned workload applicator 创建或更新 turn workload，采集 runtime 状态，写回 `AgentRunStatus`。

`AgentSession`、`AgentRun` 与 `AgentProfile` 的字段定义见各自文档。

## 规则

- platform 负责解析 `AgentProfile`、`ProviderCredentialRef` 与 egress policy。
- platform 负责把 session-level runtime reload surface 保存到 `AgentSessionSpec.RuntimeConfig`。
- platform 负责把 session-level resource reload surface 保存到 `AgentSessionSpec.ResourceConfig`。
- platform 在 submit session 时允许两种输入：
  - `profile_ref`
  - inline `profile-shaped config`
- `profile_ref` mode 下，platform 保存 `ProfileID`，并把当前 profile generation 作为 session effective config 的最近同步版本。
- inline mode 下，platform 保存 session 自己的 profile-shaped config；前端导入 profile 只做 copy。
- platform 通过 `AgentSessionCreator` 创建 session desired state。
- platform 通过 `AgentSessionReconciler` 收敛 session readiness。
- platform 通过 `AgentSessionAction` 保存同一 agentSession 串行域内的 durable action。
- platform 通过 `AgentSessionAction` 接受 turn submit，并由 action controller 调用 `AgentRunCreator` 创建 turn desired state。
- platform 通过 `AgentRunReconciler` 收敛 runtime workload。
- platform 通过 `AgentSessionStatus` 表达 session observed state。
- platform 通过 `AgentRunStatus` 表达 turn observed state。
- platform 通过 session/turn timeline 记录阶段区间与关键事件。
- runtime workload 的细粒度状态通过 `AgentRunCondition` 表达，不再单独定义 `WorkloadPhase`。
- endpoint / auth / egress policy reload 只影响后续 turn。
- skill / rule / MCP / instruction reload 只影响后续 turn。
- session workspace 与 home state 分离；workspace 重用不等于 warm state 复用。
- 当 provider capability 或 runtime 反馈表明既有热状态不可安全复用时，platform 必须推进 session `StateGeneration`，并让后续 turn 从新的 warm state 启动。
- 当前 running turn 允许 cancel；cancel 只作用于当前 turn，不关闭 session。
- 紧急 egress / auth revoke 可以挂起 session，并中止当前 turn；这不属于普通 runtime config reload。
- 同一 `AgentSession` 不允许并发 active turn。
- `Turn` 输入被接受后，必须先 durable 保存为 `AgentSessionAction`，再进入后续调度与执行。
- `AgentSessionAction` 是 turn 输入“会被执行”的调度真相；`AgentRun` 只表示已经开始的一次 execution。
- `CreateAgentSessionAction` 在接受 turn 时必须按当前 `ProviderID + ExecutionClass` 解析 `CLIDefinition.container_images[]`，并冻结具体 image、CPU request、memory request 与 auth input。
- session update 可以修改 `ExecutionClass`，但只能在当前 `ProviderID` / CLI identity 下切换 image variants。
- `AgentRunStatus.ObservedGeneration` 与 `AgentRunCondition.ObservedGeneration` 表达 controller 已处理到的 desired state generation。
- `AgentSessionStatus.RuntimeConfigGeneration` 与 `AgentSessionStatus.ResourceConfigGeneration` 表达当前可用于新 turn 的配置 generation。
- `AgentSessionReconciler` 的 implementation 组合 `AgentSessionReader`、`AgentSessionStatusWriter` 与 implementation-owned session state adapter。
- `AgentSession` controller 应放在 `packages/platform-k8s/agentsessions/`，统一使用 `agentSession` 命名，避免与其他 `session` 概念混淆。
- `AgentRunReconciler` 的 implementation 组合 `AgentRunReader`、`AgentRunStatusWriter` 与 implementation-owned workload applicator。
- 当 execution plane 是 Kubernetes 时，runtime workload 由 Kubernetes Job 执行；`AgentSession` / `AgentRun` summary state 由 platform control-plane 持久化。
- 当 execution runtime 使用 Temporal 时，所有会修改同一 session workspace/home state 的 workflow 都必须按 `session_id` 进入同一串行域。
- Temporal 编排必须保证同一 `session_id` 下的 reload、run 串行执行，避免在 session volume / PVC 上发生并发写入冲突。
- Temporal 只持有 durable execution state，不持有平台业务真相。
- `Chat` owns product metadata and session binding; `AgentSession` owns controller state; `Turn` 的 durable queue 真相是 `AgentSessionAction`。
- `AgentSession` 与 `AgentSessionAction` 由 explicit Postgres owner repositories 持有并通过 JetStream domain events 驱动；`AgentRunResource` 由 Kubernetes apiserver 持有并通过 controller-runtime reconcile。
- `AgentRun.status.resultSummary` 保存 terminal 摘要；完整 live output 通过 retained run event stream 消费。
- workflow execution、Job、Pod wait/logs 由 Temporal 与 Kubernetes 持有，作为 execution runtime 观察面。
- 在这个目标实现中，`metadata.generation` 表达 desired spec 版本，`status.observedGeneration` 表达 controller 已处理的 spec 版本；它们不等于 `metadata.resourceVersion`。
- `credential`、`model`、`provider config` 的实现层 owner 是 domain adapter；Kubernetes 只承载 runtime workload 与必要 Secret/ConfigMap。
- `AgentSessionStatus` 与 `AgentRunStatus` 都只承载 summary state。
- `AgentRunStatus` 只承载 summary state；ordered output、长文本和高频 usage 明细不进入 resource status 主路径。
- session/turn 阶段耗时与 timeline 使用单独 observability path；duration 是 timeline 的派生视图，不单独持久化为另一套真相。
- `Prometheus` 只通过 OTLP receiver 接收 timeline 的低基数 metrics projection；带 `session_id`、`turn_id`、`message_id` 的细粒度实时事件应走 `SSE`。
- Kubernetes implementation、Temporal、NATS JetStream、Postgres、Prometheus 与 Grafana 都属于 implementation/infrastructure decision，不改变当前 control-plane contract。
