# AgentSession Chat View

这份文档定义 `AgentSession` 的用户层资源管理视图，以及它与平台内部 `AgentSession` / `AgentRun` 的关系。

## 主链

```text
User
  -> Scope
  -> Chat
  -> Turn
  -> AgentSession
  -> AgentRun
  -> Execution Runtime

Scope
  -> Chat
  -> Workflow

Workflow
  -> Chat
  -> Turn
```

## 分层

### 用户层

- `Scope`
- `Chat`
- `Turn`
- `Workflow`

### 平台内部层

- `AgentSession`
- `AgentRun`

### 实现层

- `AgentSessionResource`
- `AgentRunResource`
- Temporal workflow
- Pod / PVC / Secret / logs

规则：

- 用户层不直接暴露 `AgentSession` / `AgentRun` CRUD。
- 平台内部层为用户层提供 execution/state support，但不是产品主对象。
- 实现层不反向塑造用户层概念。

## Chat

`Chat` 是用户层 session 入口和 `AgentSession` 的资源管理视图。

`Chat` 负责表达：

- 一个用户可见的 scope 归属
- 一个用户可见的 session 入口
- 绑定的 `session_id`
- session setup view
- 当前 `AgentSession` 的用户层投影
- 关联 `Turn` 列表的用户层视图

`Chat` 不负责表达：

- runtime lifecycle truth
- 当前容器是否存在
- PVC / workflow / pod identity
- turn queue / run output truth
- 一次 turn 的底层 workload handle

规则：

- `Chat` owns product metadata and session binding.
- `AgentSession` owns control-plane desired/observed state and controller status.
- `Chat` create/update writes session setup through the shared session repository.
- one `Chat` has one bound session; later updates cannot rebind it to another session.

### 最小字段

- `ChatID`
  作用：用户层稳定标识。
- `ScopeRef`
  作用：标识所属 `Scope`。
- `SessionRef`
  作用：标识对应 session。
- `DisplayName`
  作用：用户可见标题。
- `CreatedAt`
  作用：记录创建时间。
- `UpdatedAt`
  作用：记录最近更新时间。

规则：

- `Chat` 持有 product metadata 和 session binding。
- `Chat` 不持有独立 lifecycle phase。
- `Chat` 不持有 turn execution handle。

## Scope

`Scope` 是用户层归属边界的预留抽象。

当前只固定语义，不固定具体资源类型。

`Scope` 负责表达：

- `Chat` 和 `Workflow` 的归属边界
- 访问控制、资源计量、未来列表/过滤的归属维度

规则：

- `Scope` 当前是 opaque identity。
- 当前不把 `Scope` 固定成 `Project`、`Workspace`、`Tenant` 或其他具体业务对象。
- `Chat` 必须属于一个 `Scope`。
- `Workflow` 必须属于一个 `Scope`。
- `Turn` 不直接属于 `Scope`；它通过所属 `AgentSession` 的视图继承 scope。

## Turn

`Turn` 是面向 `AgentSession` 的一次用户输入及其对应用户层结果切片。

规则：

- 一个 `Turn` 最多投影为一个 `AgentRun`。
- `Turn` 创建后可以先没有 `AgentRun`。
- cancel 用户层 `Turn`，平台内部等价于取消对应 `AgentRun`，或在 `AgentRun` 尚未存在时直接终止该 `Turn`。
- `Turn` 是用户层对象；`AgentRun` 是内部执行对象。两者不共享同一 public API shape。
- `Turn` 持久化的是 result projection，不持久化 delta 型输出事件。
- `Turn` 的 durable queue 真相是 `AgentSessionAction`。

`Turn` 的详细状态机见 [agent-session-turn.md](./agent-session-turn.md)。

## Workflow

`Workflow` 是更高阶的用户层编排对象。

当前只固定边界，不固定字段：

- `Workflow` 必须属于一个 `Scope`
- `Workflow` 可以拥有多个 `Chat`
- `Workflow` 可以拥有多个 `Turn`
- `Workflow` 不直接拥有 `AgentSession`
- `Workflow` 不直接拥有 `AgentRun`

规则：

- `Workflow` 通过 `Chat` / `Turn` 间接驱动 agent execution。
- `Workflow` 的未来编排语义，不应倒逼 `AgentSession` 变成用户主对象。

## AgentSession

`AgentSession` 是平台内部 state owner。

`AgentSession` 负责表达：

- 一个固定 `agent provider / CLI` identity
- 后续 turn 的 runtime/resource reload surface
- 可恢复 warm state 的承载引用
- 当前是否 ready for next run

规则：

- 一个 `Chat` 在同一时刻最多绑定一个 active `AgentSession` 视图。
- `AgentSession` 不是用户直接 CRUD 的对象。

## AgentRun

`AgentRun` 是平台内部一次 turn execution record。

`AgentRun` 负责表达：

- 一次 turn 执行的冻结输入
- 一次 turn 的 workload handle
- 一次 turn 的 observed summary state

规则：

- 一个 `Turn` 在用户层最多暴露一个 `RunRef`。
- 一个 `AgentSession` 同时最多一个 active `AgentRun`。
- `AgentRun` 完成后不拥有 session warm state。

## Ownership

### 用户真相

- `Scope` owns user-visible ownership boundary
- `Chat` owns user-visible session management view and session binding
- `Turn` owns one input and one result-style output slice
- `Workflow` owns higher-level orchestration intent

### 平台真相

- shared session repository owns desired/observed session state
- `AgentSession` controller owns convergence from session state to runtime
- `AgentRun` owns one turn execution summary

### 实现真相

- runtime workload owns only ephemeral execution
- PVC/Secret/logs own implementation artifacts

## Projection

### Chat -> AgentSession

`Chat` 投影到 `AgentSession` 的内容：

- session identity
- session lifecycle
- session readiness
- session-level config 的用户层展示

规则：

- `Chat` owns product-facing metadata and projects live session status.
- `Chat` setup 必须显式区分：
  - `profile` mode
  - `inline` mode
- `profile` mode 下：
  - chat 创建时生成 profile-backed session
  - 创建后 `profile_id` 固定，不允许切到另一个 profile
- `inline` mode 下：
  - chat 页面先把 profile 投影成完整 inline config draft
  - 导入后 session 不再绑定该 profile
  - 后续只允许修改 future-turn config，不允许改变 CLI identity
- 用户在 `Chat` 入口修改 session setup；session repository 保存状态，`AgentSession` controller 负责收敛执行状态。
- `Chat` 不直接投影 Pod / Workflow / PVC identity。
- `Scope` 不直接投影成 `AgentSession` 字段；scope 是用户层归属语义，不是内部 execution state。

### Turn -> AgentRun

`Turn` 投影到 `AgentRun` 的内容：

- 本次输入
- 启动时冻结的 session/runtime/resource/state generation
- cancel / terminal result

规则：

- `Turn` 创建时，platform 先保存用户输入。
- 当 execution 前置条件满足时，platform 再基于当前 `AgentSession` 为该 `Turn` 创建一个 `AgentRun`。
- `AgentRun` 执行过程中产生的 output stream 回投影到用户层 `Turn` 的 result-style output slice。
- browser-facing chat 通过 `platform-chat-service`/management stream 消费 live delta；terminal result 由 NATS result event projector 写入 `AgentRun.status.resultSummary`。
- `retry` 永远创建新的 `Turn`，而不是为旧 `Turn` 创建新的 `AgentRun`。

## 关系图

```text
Scope (user-visible ownership boundary)
  1 -> N Chat
  1 -> N Workflow

Chat (user-visible session view)
  N -> 1 Scope
  1 -> 1 AgentSession view

Turn (user-visible session-facing input)
  N -> 1 AgentSession
  1 -> 0..1 AgentRun

Workflow (future user-visible orchestration)
  N -> 1 Scope
  1 -> N Chat / Turn

AgentSession (internal state owner)
  1 -> N Turn
  1 -> N AgentRun (historical)
  1 -> 0..1 active AgentRun
```

## 规则

- `AgentSession` 是 internal resource，不是 user CRUD object。
- `AgentRun` 是 internal execution record，不是 user CRUD object。
- `Scope` 是用户层归属对象占位，不进入当前 internal execution contract。
- 用户取消的是 `Turn`；平台内部取消的是对应 `AgentRun`。
- 用户在 `Chat` 入口更新的是 session setup；数据写入共享 session repository，controller 只负责收敛。
- `Chat` / `Turn` 是产品模型；`AgentSession` / `AgentRun` 是 control-plane 模型。
