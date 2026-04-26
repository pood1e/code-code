## responsibility

`AgentSession` warm-state reset 负责把 session 的热状态切换收口成一个串行 action。

## fields

- `reset_warm_state.session_generation`
  - 作用：标识 reset 接受时绑定的 session generation。
- `reset_warm_state.source_home_state_id`
  - 作用：标识 reset 前的 warm-state carrier。
- `reset_warm_state.target_home_state_id`
  - 作用：标识 reset 后的新 warm-state carrier。

## implementation

- `ResetAgentSessionWarmState` 只创建 `AgentSessionAction(type=RESET_WARM_STATE)`。
- action 接受时冻结：
  - `source_home_state_id`
  - `target_home_state_id`
- action 执行时只负责把 `spec.session.home_state_ref.home_state_id` 切到 `target_home_state_id`。
- `AgentSession` controller 负责：
  - 为新的 `home_state_id` ensure PVC
  - 在 PVC `Bound` 后把 `WarmStateReady=True`
  - 推进 `state_generation`
- session setup update 不允许直接修改 `home_state_ref.home_state_id`；warm-state reset 只由 reset action owner 承担。
