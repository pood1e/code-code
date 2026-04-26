# AgentSession

这份文档定义 `AgentSession` 的平台抽象。

跨语言 data model 由 `packages/go-contract/platform/agent_session/v1` 提供。

`AgentSession` 是平台内部 control-plane resource，不是用户直接 CRUD 的产品对象。
用户层关系见 [agent-session-chat-view.md](./agent-session-chat-view.md)。
观测模型见 [agent-session-observability.md](./agent-session-observability.md)。
串行动作模型见 [agent-session-action.md](./agent-session-action.md)。

## 模型图

```text
AgentSessionSpec
  -> SessionID
  -> ProfileID
  -> ProfileGeneration
  -> ProviderID
  -> ExecutionClass
  -> RuntimeConfig
  -> ResourceConfig
  -> PrepareJobs
  -> WorkspaceRef
  -> HomeStateRef

AgentSessionRef
  -> SessionID

AgentSessionState
  -> Generation
  -> Spec
  -> Status

AgentSessionStatus
  -> SessionID
  -> Phase
  -> ObservedGeneration
  -> RuntimeConfigGeneration
  -> ResourceConfigGeneration
  -> RealizedRuleRevision
  -> RealizedSkillRevision
  -> RealizedMCPRevision
  -> StateGeneration
  -> Message
  -> ActiveRunID
  -> Conditions
  -> UpdatedAt
```

## 职责

`AgentSession` 负责表达：

- 一个可恢复的 agent session desired state
- 一个固定 `agent provider / CLI` identity
- 后续 turn 的 runtime config 与 resource config
- session 热状态的承载引用
- session observed summary state
- session timeline 的 domain owner

`AgentSession` 不等于一个持续运行中的容器。
idle 时可以 `scale-to-zero`；下一次 turn 到来时，再由 execution runtime 拉起 workload 并恢复 session 热状态。

## AgentSessionSpec

- `SessionID`
  作用：标识一个稳定的 agent session。
- `ProfileID`
  作用：在 `profile_ref` mode 下标识直接使用的 `AgentProfile`。
- `ProfileGeneration`
  作用：在 `profile_ref` mode 下记录最近一次同步到 session effective config 的 profile generation。
- `ProviderID`
  作用：标识这个 session 绑定的固定 `agent provider / CLI` identity。
- `ExecutionClass`
  作用：标识这个 session 后续 turn 使用的当前 execution class；真源来自 `CLIDefinition.container_images[]`。
- `RuntimeConfig`
  作用：保存后续 turn 使用的 runtime reload surface。
- `ResourceConfig`
  作用：保存可直接用于下一次 run 的 `agent.cap.v1.AgentResources` snapshot。
- `PrepareJobs`
  作用：保存 session-owned CLI prepare job envelope；同一个 session 可以保存多个 CLI 的 YAML 参数。
- `WorkspaceRef`
  作用：引用 session 工作目录承载面。
- `HomeStateRef`
  作用：引用 session 可恢复热状态承载面。

规则：

- session 可以直接由 `profile_ref` 创建，也可以直接提交 inline `profile-shaped config` 创建。
- `profile_ref` mode 下，session 不能编辑 profile-shaped config：
  - `ProviderID`
  - `ExecutionClass`
  - `RuntimeConfig`
  - `ResourceConfig`
- inline mode 下，session 可以编辑自己的 profile-shaped config。
- 前端导入 profile 到 inline session draft 只做 copy，不建立 runtime 关联。
- `ProviderID` 一旦确定后不可变；session 不允许 rebind 到另一个 CLI identity。
- `ExecutionClass` 只允许在同一个 `ProviderID` / CLI identity 下切换 image variants。
- `ExecutionClass` 的可编辑性取决于 session 是否直接绑定 `profile_ref`：
  - `profile_ref` mode 不可编辑
  - inline mode 可编辑
- `RuntimeConfig` 与 `ResourceConfig` 更新只影响后续 turn，不影响当前 running turn。
- `PrepareJobs.parameters_yaml` 由对应 CLI prepare job 解释，session core 不解析 YAML 内部字段。
- `WorkspaceRef` 与 `HomeStateRef` 都是实现无关的 opaque handle；不暴露 Kubernetes PVC 细节。
- `WorkspaceRef` 表达代码 / 工作目录承载面。
- `HomeStateRef` 表达 CLI 私有热状态承载面。

## RuntimeConfig

`RuntimeConfig` 负责表达后续 turn 的 runtime reload surface：

- 当前主线只固定 `provider_surface_binding_ref`
- `fallbacks[]` 表示后续 turn 的 secondary runtime candidates
- `provider_surface_binding_ref` 表示后续 turn 使用的 primary runtime binding

它不表达当前 running turn 已冻结的 concrete execution input。

`fallbacks[]` 的每个 candidate 固定包含：

- `provider_surface_binding_ref`
- `model_ref` 或 `provider_model_id`

规则：

- `RuntimeConfig` 保存的是 future-turn runtime policy surface，不是已解析完成的 `ResolvedProviderModel`。
- primary runtime candidate 由 `provider_surface_binding_ref` 加 submit-time 的 model resolution 共同确定。
- `fallbacks[]` 只保存 secondary candidates；不重复 primary candidate。
- session 必须保持 self-contained；submit path 不读取 live `AgentProfile` 来补 fallback chain。
- `run_turn` 在接受时必须把 primary + secondary candidates 一次性解析并冻结到 action snapshot。
- 当前 controller 只消费 frozen chain 的第一个 candidate 创建 `AgentRun`；后续自动 fallback 只能在这条已冻结 chain 内推进，不能重新读取 session/profile 漂移。

## ResourceConfig

`ResourceConfig` 直接保存 `agent.cap.v1.AgentResources` snapshot。

规则：

- 非空 `resource_config.snapshot_id` 是当前 session 期望使用的 resource revision；空 `resource_config` 没有待 materialize 内容，可以直接视为 ready。
- controller 会从整份 snapshot 导出三个稳定局部 revision：
  - `rule_revision`
  - `skill_revision`
  - `mcp_revision`
- 当某个 realized revision 落后于当前 desired revision 时，session controller 必须创建对应的 `reload_subject(rule|skill|mcp)` action。
- 用户显式更新 session 时，可以提交一次 `reload_subject(resource_config)` force reload；它会整体重做 rule / skill / mcp realize。
- `reload_subject(...)` 必须先把当前 effective `resource_config` materialize 到 session-scoped artifact，再推进 realized revision。
- 只有该 action 成功后，`ResourceConfigReady` 才能为 `True`。

## AgentSessionStatus

- `SessionID`
  作用：关联对应 `AgentSessionSpec`。
- `Phase`
  作用：表达 session 当前生命周期阶段。
- `ObservedGeneration`
  作用：标识 controller 已处理到的 session desired generation。
- `RuntimeConfigGeneration`
  作用：标识当前可用于新 turn 的 runtime config generation。
- `ResourceConfigGeneration`
  作用：标识当前可用于新 turn 的 resource config generation。
- `RealizedRuleRevision`
  作用：标识当前已 realize 到 session 串行域的 rule revision。
- `RealizedSkillRevision`
  作用：标识当前已 realize 到 session 串行域的 skill revision。
- `RealizedMCPRevision`
  作用：标识当前已 realize 到 session 串行域的 mcp revision。
- `Message`
  作用：保存当前状态说明。
- `StateGeneration`
  作用：标识当前可复用 warm state generation。
- `ObservedHomeStateID`
  作用：标识当前 `StateGeneration` 绑定的 `home_state_id`。
- `ActiveRunID`
  作用：引用当前正在执行的 turn 的 RunID。
- `Conditions`
  作用：表达 session readiness 与执行状态；Kubernetes resource 使用 `metav1.Condition` schema。
- `UpdatedAt`
  作用：记录 status 更新时间。

`Phase` 取值：

- `Pending`
  作用：session 已创建，但尚未达到可执行状态。
- `Ready`
  作用：session 可接受下一次 turn，且当前没有 active turn。
- `Running`
  作用：session 当前有 active turn 正在执行。
- `Failed`
  作用：session 进入不可继续主路径的错误状态。

规则：

- session phase 不表达 Pod / Workflow 是否存在。
- 同一时刻最多一个 `ActiveRun`。

## Conditions

`AgentSession` 至少暴露以下稳定 condition type：

- `WorkspaceReady`
  作用：workspace 已准备好供后续 turn 使用。
- `WarmStateReady`
  作用：home state 已准备好供后续 turn 使用。
- `RuntimeConfigReady`
  作用：runtime reload surface 已为下一次 turn 准备好。
- `ResourceConfigReady`
  作用：resource reload surface 已为下一次 turn 准备好。
- `ReadyForNextRun`
  作用：session 当前可接受下一次 turn。

`ReadyForNextRun=True` 的前提：

- `WorkspaceReady=True`
  - 当前 `workspace_ref.workspace_id` 对应的 session-scoped PVC 已创建且未 `Lost`
- `WarmStateReady=True`
  - 当前 `home_state_ref.home_state_id` 对应的 session-scoped PVC 已创建且未 `Lost`
- `RuntimeConfigReady=True`
- `ResourceConfigReady=True`
- 当前 desired rule / skill / mcp revision 都已经 realize
- 当前 resource materialization artifact 与 desired `resource_config` 匹配
- 当前没有 nonterminal `reset_warm_state` action
- 当前没有 active run
- session phase 允许接受新 turn

PVC 使用 `WaitForFirstConsumer` 的 StorageClass 时，首次 run Pod 调度前会保持 `Pending`；session readiness 不以 `Bound` 作为前置条件。

session condition vocabulary 见 [agent-session-conditions.md](./agent-session-conditions.md)。

## Warm State

`HomeStateRef` 承载 CLI 私有热状态。

`StateGeneration` 表达当前可复用热状态版本。

规则：

- 资源或运行配置变化不自动要求重置 warm state。
- 当 provider capability 或 runtime 反馈表明既有 state 不再安全可复用时，platform 必须通过 `reset_warm_state` action 重置 warm state，并推进 `StateGeneration`。
- `StateGeneration` 变化只影响后续 turn，不回写当前 running turn。
- controller 只在 `home_state_ref.home_state_id` 首次可用或发生切换时推进 `StateGeneration`。
- `WorkspaceRef` 与 `HomeStateRef` 分离：workspace 不是 warm state，本地代码目录重用不等于 CLI session state 复用。
- execution runtime 固定消费：
  - `workspace_dir=/workspace`
  - `data_dir=/home/agent`

## Runtime Reload 与紧急吊销

正常 `RuntimeConfig` 更新只影响后续 turn。

例外情况：

- 平台可以对 network / auth 做紧急吊销。
- 紧急吊销不属于普通 reload 语义；它可以直接让 `ReadyForNextRun=False`，并由 execution runtime 中止当前 turn。

## Kubernetes Target

在 Kubernetes execution plane 上，`AgentSession` 的目标语义如下。

### 主链

```text
Platform API
  -> AgentSessionCreator
  -> AgentSession resource create/update
  -> controller reconcile
  -> session status subresource update
```

### 规则

- `AgentSession` 是业务真相。
- `AgentSessionSpec` 必须保存 self-contained effective config。
- profile-backed session 通过 `platform-profile-service` gRPC 投影 effective config；controller 不直接读取 profile-owned resources。
- `AgentRun` 表示这个 session 内的一次 turn / invocation。
- `AgentSessionAction` 表示这个 agentSession 串行域内的一次 durable action。
- `Workflow` / `Job` 只是 turn execution runtime，不是 session 真相。
- session workspace 与 home state 的实现当前目标都是 session 专属 volume / PVC，但这属于 implementation decision，不进入 public contract。
- `AgentSession` 是 stateful mutation 的串行边界。
- 任何会修改 session workspace 或 home state 的动作都必须在同一个 `session_id` 串行域内执行。
- 当前主线只实现 `reload_subject(...)` 与 `AgentRun` execute/result writeback 进入该串行域。
- 同一 `session_id` 下不允许并发 reload 与 run。
