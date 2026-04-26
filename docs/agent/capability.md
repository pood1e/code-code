# Agent Capability Contract

这份文档定义 `agent provider` 的 capability contract。

## 主链

```text
AgentDescriptor
  -> Capabilities

AgentRuntime
  -> AgentResources
  -> InstructionResource
  -> ToolBinding
```

## 职责

`Capabilities` 负责表达：

- provider 支持哪些平台能力
- resource 变化后既有 `resume_token` 是否仍然安全

`AgentResources` 负责表达：

- platform 下发给 provider 的 resources snapshot

## Capabilities

- `Resume`
  作用：是否支持继续上下文。
- `Tools`
  作用：是否支持 tool 接入。
- `Instructions`
  作用：是否支持 instruction 输入。
- `ResumeAfterInstructionChange`
  作用：instruction snapshot 变化后，既有 `resume_token` 是否仍可使用。
- `ResumeAfterToolChange`
  作用：tool binding snapshot 变化后，既有 `resume_token` 是否仍可使用。
- `HeadlessCompaction`
  作用：是否支持 headless session compaction。

规则：

- `Capabilities` 不表达 resource 是否可以下发。
- `Capabilities` 只表达 provider 支持什么，以及 resource 变化后的 resume 安全边界。
- platform 通过 `ApplyResources` 下发 resource snapshot。
- platform 根据 `ResumeAfter*` 决定是继续既有 session，还是创建新 session。
- `ResumeAfterInstructionChange` 要求同时支持 `Resume` 与 `Instructions`。
- `ResumeAfterToolChange` 要求同时支持 `Resume` 与 `Tools`。
- `HeadlessCompaction` 要求支持 `Resume`。

## AgentResources

- `SnapshotID`
  作用：resource snapshot 版本标识。
- `Instructions`
  作用：instruction 资源集合。
- `ToolBindings`
  作用：tool 绑定集合。

规则：

- `SnapshotID` 由 platform 生成。
- `SnapshotID` 是 opaque string；provider 只做相等性比较，不依赖格式。
- 不同有效 resource snapshot 必须使用不同 `SnapshotID`。
- `InstructionResource.Name` 在同一个 snapshot 内必须唯一。
- `ToolBinding.Name` 在同一个 snapshot 内必须唯一。

## InstructionResource

- `Kind`
  作用：instruction 类型。
- `Name`
  作用：instruction 稳定名称。
- `Content`
  作用：instruction 内容。

## ToolBinding

- `Name`
  作用：tool 稳定名称。
- `Kind`
  作用：tool 接入类型。
- `Target`
  作用：tool 目标端点或目标资源。

## 外部边界

以下内容不属于 `Agent Capability Contract`：

- LLM credential
- model discovery
- fallback models

这些由 [../provider/model.md](../provider/model.md) 单独定义。
