# ExecutionClass

## 职责

`ExecutionClass` 表示同一 CLI identity 下一个可运行的 container variant selector。

它负责表达：

- 一个稳定的 execution class 标识
- 对应的 CLI main container image
- 对应的默认 CPU request
- 对应的默认 memory request

## Source Of Truth

`ExecutionClass` 的真源是 `CLIDefinition.container_images[]`。

每个 container image entry 至少包含：

- `ExecutionClass`
- `Image`
- `CPURequest`
- `MemoryRequest`

## 规则

- `AgentProfile.SelectionStrategy.ExecutionClass` 只保存默认 execution class selector。
- `AgentSession.ExecutionClass` 表达后续 turn 使用的当前 execution class；可以更新。
- `AgentSession.ExecutionClass` 只能在同一个 `ProviderID` / CLI identity 对应的 image variants 内切换。
- `profile_ref` mode 下，`ExecutionClass` 跟随 profile effective config，不允许在 session 内单独改。
- inline mode 下，`ExecutionClass` 可以在 session 内修改。
- execution class 更新只影响后续 turn，不影响当前 running turn。
- `AgentRun` 在 submit 时必须冻结 resolved execution class、container image、CPU request 与 memory request。
- workflow / pod template 只消费 `AgentRun` 已冻结的具体 image 与 resource requests。
