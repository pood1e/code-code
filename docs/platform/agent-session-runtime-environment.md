## responsibility

`AgentSession` runtime environment 负责把 session 的 `workspace_ref` 与 `home_state_ref` 落成可被 execution runtime 消费的 carrier 和目录。

## fields

- `spec.session.workspace_ref.workspace_id`
  - 作用：标识 workspace carrier。
- `spec.session.home_state_ref.home_state_id`
  - 作用：标识 warm-state carrier。
- `status.state_generation`
  - 作用：标识当前 warm-state carrier version。
- `status.observed_home_state_id`
  - 作用：标识当前 `state_generation` 绑定的 carrier。
- `run_turn.runtime_environment`
  - 作用：冻结当前 turn 使用的 `workspace_dir` 与 `data_dir`。
- `agent_run.spec.runtime_environment`
  - 作用：供 workflow/runtime 直接消费。

## implementation

- `run_turn.runtime_environment` 固定冻结：
  - `workspace_dir=/workspace`
  - `data_dir=/home/agent`
- `AgentSession` controller 负责确保 session-scoped workspace/home-state PVC 存在；已有 PVC 只观察不重写。
- stale carrier cleanup 只删除不再被以下对象引用的 PVC：
  - 当前 session spec
  - nonterminal `AgentSessionAction.run_turn`
  - nonterminal `AgentRun`
- `WorkspaceReady=True` 与 `WarmStateReady=True` 的前提是对应 PVC 已存在且 `status.phase=Bound`。
- `state_generation` 只在 `home_state_id` 首次可用或发生切换时推进。
- `run_turn` 在接受时冻结 `RuntimeEnvironment`。
- `AgentRun` 必须持有 submit-time frozen `runtime_environment`。
- workflow runtime 只消费 `AgentRun.spec.runtime_environment` 和 frozen carrier IDs：
  - workspace PVC 挂到 `workspace_dir`
  - home-state PVC 挂到 `data_dir`
  - main container `workingDir=workspace_dir`
  - `HOME=data_dir`
