# Platform State Contracts

这份文档定义 platform-owned state 的公共 contract。

## 模型图

```text
Platform Postgres State
  -> Chat
DomainStateStore
  -> AgentSession
  -> AgentSessionAction
  -> runtime projections
Kubernetes API
  -> AgentRunResource
```

## 边界

这些 state contract 负责保存或读取 platform-owned desired state 与 observed state。
平台产品状态默认由 explicit Postgres-backed owner APIs 承载；Kubernetes 只承载 runtime workload、Kubernetes-owned config/state、必要 runtime projection，以及由 Kubernetes controller 真正 reconcile 的 `AgentRunResource`。

credential、egress policy、model 与 provider catalog 的 runtime contract 直接复用各自 domain owner 的 contract，不在 platform state contract 中重复定义。

`AgentSession` 见 [agent-session.md](./agent-session.md)。  
`AgentRun` 见 [agent-run.md](./agent-run.md)。  
`AgentProviderBinding` 见 [agent-provider-binding.md](./agent-provider-binding.md)。  
`AgentProfile` 见 [agent-profile.md](./agent-profile.md)。  
Postgres adapter 见 [postgres-state-store.md](./postgres-state-store.md)。

## 外部 Contract

直接复用的外部 contract：

- provider endpoint/config 的数据 owner 由 [../provider/model.md](../provider/model.md) 定义，不在 platform state contract 中重复定义。
- provider definition 的数据 owner 由 [../provider/model.md](../provider/model.md) 定义。
- credential resolution 直接复用 `credential.Resolver`。
- egress policy resolution 直接复用 platform egress policy catalog。
- model definition 与 resolution 直接复用 `model.Registry`。

## ChatStore

方法：

- `CreateChat/GetChat/UpdateChatSessionSetup/RenameChat/ListChats`
  作用：保存用户层 chat metadata 与 `session_id` 绑定。

说明：

- `Chat` 是产品入口和 session binding owner。
- `ListChats` 按 `updated_at` 返回最近 chat metadata，包括 `display_name`，用于浏览器恢复和切换入口。
- session setup/state 存在 session repo，不存在 chat repo。
- `AgentSession` setup/status 存在 `packages/session` repo；`AgentSessionAction` 是 turn queue 真相，`AgentRunResource` 是 runtime run 真相。
- `ChatStore` 不保存 turn queue、run output 或 timeline event stream。

## DomainStateStore

方法：

- `GetAgentSessionAction`
  作用：读取一次用户 turn 对应的 durable action。

说明：

- `AgentSessionAction` 与 `AgentRun` 是 turn/run 主数据。
- terminal `RunResult` 由 runtime service 写入 `AgentRun.status.resultSummary`。
- delta stream、timeline history、pod/workflow/log 不进入 Postgres 主数据表。

## AgentSessionReader

方法：

- `Get(session_id)`
  作用：读取一个 agent session desired/observed state。

## AgentSessionStatusWriter

方法：

- `UpdateStatus(session_id, status)`
  作用：写入一次 session observed state；当 `status.observed_generation` 非 0 时，必须等于当前 stored desired generation，防止 stale status 覆盖新状态。
  说明：`session_id` 与 `status.session_id` 必须指向同一个 session。

说明：

- `AgentSessionStatus.StateGeneration` 是 session warm state 的 observed version。
- `AgentSessionStatus.ObservedHomeStateID` 标识当前 `StateGeneration` 绑定的 `home_state_id`。
- controller 重置 warm state，或 `home_state_ref` 切换时，应在写入新 status 时推进 `StateGeneration`。

- chat 创建/更新通过 `packages/session.Repository` 写入 session desired state。
- `CreateAgentSessionAction` 是 turn durable submit 的 public 提交入口；action dispatch 后创建 `AgentRunResource`，由 Kubernetes controller-runtime reconciler 驱动 Temporal workflow。
- `AgentSessionReader` 与 `AgentSessionStatusWriter` 分别承担读取与 status update，避免把 create/read/status-update 混成单一宽接口。
- `AgentRunResource` 写 status subresource；`AgentSession` / `AgentSessionAction` 不再建模为 apiserver CRD。
