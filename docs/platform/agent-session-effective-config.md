## responsibility

`AgentSession` effective config 负责把 session 输入收口成当前可执行的 self-contained spec。

## fields

- `spec.session.profile_id`
  - 作用：声明这个 session 的 provider/runtime/resource config 来自 `AgentProfile`。
- `spec.session.profile_generation`
  - 作用：记录当前已投影到 session spec 的 profile store generation。
- `spec.session.runtime_config.primary_model_selector`
  - 作用：保存 primary runtime candidate 的默认 model selector。
- `spec.session.resource_config`
  - 作用：保存当前 effective `AgentResources` snapshot。
- `status.observed_home_state_id`
  - 作用：记录当前 `StateGeneration` 绑定的 `home_state_id`。
- `status.state_generation`
  - 作用：记录当前 warm state carrier 的 observed version。

## implementation

- create/update path：
  - inline session 直接使用请求中的 provider/runtime/resource config。
  - profile-backed session 通过 `platform-profile-service` gRPC 从 `AgentProfile`、`Skill`、`Rule`、`MCPServer` 投影出完整 effective config。
- reconcile path：
  - `AgentSession` controller 只处理 session-owned reconcile，不 watch profile-owned resources。
  - profile-owned changes enter session projection through profile service APIs and future explicit session updates.
- `resource_config` realize：
  - `reload_subject(...)` 必须先把当前 effective `resource_config` materialize 到 session-scoped ConfigMap，再推进 realized revisions。
  - `ResourceConfigReady=True` 的前提是 desired revisions 已 realize，且当前 materialization artifact 存在并匹配。
- `run_turn` 接受 gate：
  - `ReadyForNextRun=True`
  - `ReadyForNextRun.observed_generation == session.metadata.generation`
  - `runtime_config_generation == session.metadata.generation`
  - `resource_config_generation == session.metadata.generation`
- `state_generation` owner：
  - 当前主线不实现独立 warm-state reset action。
  - controller 只在 `home_state_ref.home_state_id` 首次可用或发生切换时推进 `state_generation`。
  - runtime/resource/profile drift 不得单独推进 `state_generation`。
