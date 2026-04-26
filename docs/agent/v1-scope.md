# Agent V1 Contract

这份文档定义 V1 要落代码的最小 contract。  
目标模型见 [model.md](./model.md)。  
capability 见 [capability.md](./capability.md)。  
policy 见 [policy.md](./policy.md)。  
input 见 [input.md](./input.md)。  
output 见 [output.md](./output.md)。  
result 见 [result.md](./result.md)。  
runtime 见 [runtime.md](./runtime.md)。

## V1 主链

```text
Platform
  -> AgentProvider
  -> AgentRuntime
  -> AgentResources
  -> RunRequest
  -> Run
  -> RunOutput
  -> RunResult
```

## V1 目标

V1 只覆盖最小闭环：

- 平台识别 agent provider
- 平台创建 runtime
- 平台下发 resources
- 平台解析 provider/model binding
- 平台启动 run
- 平台消费 output stream
- 平台获取最终 result

## V1 范围

V1 只定义两层 contract：

1. `packages/agent-go-contract/agent/*/v1` 的 data contract
2. `packages/agent-runtime-contract/agent` 的 Go behavior interface

## V1 Public API

### Data Contract

- `core/v1`
  作用：`AgentDescriptor`、`RuntimeEnvironment`、`RunRequest`，包含 platform 已解析的 provider/model binding。
- `cap/v1`
  作用：`Capabilities`、`AgentResources`、`InstructionResource`、`InstructionKind`、`ToolBinding`、`ToolKind`。
- `input/v1`
  作用：`InputSchema`、`InputSchemaFormat`、`RunInput`。
- `policy/v1`
  作用：`LLMProviderFilter`。
- `output/v1`
  作用：`RunOutput`、所有 output payload、`UsageCounters`、`TurnCounters`。
- `result/v1`
  作用：`RunResult`、`RunStatus`、`RunError`。

### Go Behavior Interface

- `AgentProvider`
- `AgentRuntime`
- `Run`

## V1 核心类型

### AgentDescriptor

- `ProviderID`
  作用：provider 稳定注册 ID。
- `DisplayName`
  作用：provider 展示名称。
- `Capabilities`
  作用：provider 能力声明。
- `InputSchema`
  作用：provider-facing extension parameters schema。
- `LLMProviderFilter`
  作用：约束这个 agent 可使用的外部 `LLM provider definitions` 和模型能力。

### RuntimeEnvironment

- `WorkspaceDir`
  作用：工作目录根位置。
- `DataDir`
  作用：provider 私有数据根目录。

### RunRequest

- `RunID`
  作用：平台侧 run 标识。
- `TraceID`
  作用：平台 trace 关联标识。
- `Input`
  作用：本次 run 的 provider-facing input。
- `ResumeToken`
  作用：继续上下文所需标识。
- `ResolvedProviderModel`
  作用：platform 已解析完成的 provider/model binding。

### RunOutput

表示运行中的有序输出流。  
payload 见 [output.md](./output.md)。

### RunResult

表示最终状态与继续信息。  
字段见 [result.md](./result.md)。

## 外部边界

以下内容不属于 `Agent V1 Contract`：

- LLM credential
- model discovery
- fallback models
- egress policy

这些分别由：

- [../credential/model.md](../credential/model.md)
- [../provider/model.md](../provider/model.md)
- [../model/model.md](../model/model.md)
- [../platform/network-egress-policy.md](../platform/network-egress-policy.md)

`ModelCapability` 也由 `model` contract 定义，`agent` 只引用。
