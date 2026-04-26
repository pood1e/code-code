# Agent 平台接入模型

这份文档定义 platform、backend runtime、frontend 共享的 `agent` contract。  
capability 见 [capability.md](./capability.md)。  
policy 见 [policy.md](./policy.md)。  
input 见 [input.md](./input.md)。  
message 见 [message.md](./message.md)。  
output 见 [output.md](./output.md)。  
result 见 [result.md](./result.md)。  
runtime 见 [runtime.md](./runtime.md)。

## 主链

```text
Platform
  -> AgentProvider
  -> AgentDescriptor
  -> AgentRuntime
  -> AgentResources
  -> RunRequest
  -> Run
  -> AG-UI RunOutput
  -> AG-UI Message
  -> RunResult
```

## 分层

`packages/agent-go-contract/agent/*/v1` 负责：

- 跨语言 data model
- Go / TS 生成来源
- platform、backend、frontend 共享的数据真相

`packages/agent-runtime-contract/agent` 负责：

- backend 内部的 Go behavior interface
- platform 如何驱动 agent provider

`packages/agent-contract` 负责：

- 导出 frontend 使用的 TS model

## Ownership

`agent` contract 负责：

- provider descriptor
- runtime environment
- provider-facing input
- reusable AG-UI message contract
- platform-resolved provider model binding
- ordered output stream
- final run result

它不负责：

- LLM credential
- model discovery
- fallback models
- egress policy

这些分别由：

- [../credential/model.md](../credential/model.md)
- [../provider/model.md](../provider/model.md)
- [../model/model.md](../model/model.md)
- [../platform/network-egress-policy.md](../platform/network-egress-policy.md)

## 模块职责

### Core

位置：

- `packages/agent-go-contract/agent/core/v1`

负责：

- `AgentDescriptor`
- `RuntimeEnvironment`
- `RunRequest`

### Capability

位置：

- `packages/agent-go-contract/agent/cap/v1`

负责：

- provider capability
- capability resources

字段见 [capability.md](./capability.md)。

### Input

位置：

- `packages/agent-go-contract/agent/input/v1`

负责：

- input schema
- provider-facing run input

字段见 [input.md](./input.md)。

### Policy

位置：

- `packages/agent-go-contract/agent/policy/v1`

负责：

- agent 对 `LLM provider` 的过滤约束

字段见 [policy.md](./policy.md)。

### Output

位置：

- `packages/agent-go-contract/agent/output/v1`

负责：

- ordered run output
- AG-UI event envelope

字段见 [output.md](./output.md)。

### Message

负责：

- reusable AG-UI message contract
- final result-style message semantics

字段见 [message.md](./message.md)。

### Result

位置：

- `packages/agent-go-contract/agent/result/v1`

负责：

- final run result
- final status
- structured run error

字段见 [result.md](./result.md)。

## Core 类型

### AgentDescriptor

- `ProviderID`
  作用：provider 稳定注册 ID。
- `DisplayName`
  作用：provider 展示名称。
- `Capabilities`
  作用：provider capability 声明。
- `InputSchema`
  作用：provider extension parameters schema。
- `LLMProviderFilter`
  作用：约束这个 agent 可使用的外部 `LLM provider definitions` 和模型能力。

### RuntimeEnvironment

- `WorkspaceDir`
  作用：runtime workload 内部可见的工作目录根位置。
- `DataDir`
  作用：runtime workload 内部可见的 provider 私有数据根目录。

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

## Go Behavior Interface

`AgentProvider`
  作用：provider 接入入口。

`AgentRuntime`
  作用：可被 platform 驱动的 runtime。

`Run`
  作用：运行中的一次 run。

方法见 [runtime.md](./runtime.md)。

## Package Layout

```text
packages/agent-go-contract/agent/core/v1
packages/agent-go-contract/agent/cap/v1
packages/agent-go-contract/agent/policy/v1
packages/agent-go-contract/agent/input/v1
packages/agent-go-contract/agent/output/v1
packages/agent-go-contract/agent/result/v1
packages/agent-go-contract
packages/agent-runtime-contract
packages/agent-contract
```

## 参考 sources

- OpenAI Agents SDK
  - https://openai.github.io/openai-agents-js/
- Microsoft AutoGen
  - https://microsoft.github.io/autogen/
- Claude Agent SDK
  - https://code.claude.com/docs/en/agent-sdk/overview
