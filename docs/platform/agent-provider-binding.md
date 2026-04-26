# Agent Provider Binding

这份文档定义 `AgentProviderBinding` 的平台抽象。

跨语言 data model 由 `packages/agent-go-contract/platform/agent_provider_binding/v1` 提供。

## 模型图

```text
AgentProviderBinding
  -> ProviderID
  -> Enabled

AgentProviderBindingReader
  -> Get(provider_id)
```

## 职责

`AgentProviderBinding` 负责表达：

- 哪个 agent provider 可供 profile / session / run 使用

## AgentProviderBinding

- `ProviderID`
  作用：对应 agent provider identity。
- `Enabled`
  作用：表示该 provider 是否可被平台 session / run 使用。

规则：

- platform 只保存 binding，不保存 provider descriptor。
- `AgentProfile.SelectionStrategy.ProviderID` 必须引用一个 `Enabled=true` 的 binding。
- profile 选择必须显式发生；不再通过 binding 隐式下发默认 profile。

## AgentProviderBindingReader

方法：

- `Get(provider_id)`
  作用：查询一个 platform-owned agent provider binding。
