# Agent Policy Contract

这份文档定义 agent 对外部 `LLM provider` 的选择约束。

## 模型图

```text
AgentDescriptor
  -> LLMProviderFilter
```

## LLMProviderFilter

表示某个 agent 可接受的 `LLM provider` 过滤规则。

字段：

- `AllowedSurfaceIDs`
  作用：声明这个 agent 允许使用的 stable provider surface definition ID 列表；为空时表示不按 definition ID 限制。
- `RequiredModelCapabilities`
  作用：声明这个 agent 要求所选模型必须具备的能力集合；能力标签由 [../model/model.md](../model/model.md) 定义。

典型值：

- `openai-responses`
- `openai-compatible`
- `anthropic`
- `codex`
- `claude-code`

说明：

- `AllowedSurfaceIDs` 表达稳定接入面定义。
- `ProtocolEndpoint` 优先按协议接入面命名，例如 `openai-responses`、`openai-compatible`、`anthropic`。
- `NativeProvider` 优先按原生产品或 CLI type 命名，例如 `codex`、`claude-code`。
- `Protocol` 仍然由 `provider` contract 表达。

## 过滤策略

`LLMProviderFilter` 由 agent/runtime 自己解释并执行。

platform 只负责提供当前可用的 provider endpoint、endpoint 与 observed catalog 事实，不负责最终模型选择。

## 边界

`LLMProviderFilter` 只表达 agent 的选择约束。

它不承载 credential、model catalog、fallback model 或 proxy。

这部分由 [../credential/model.md](../credential/model.md)、[../provider/model.md](../provider/model.md) 和 [../platform/network-egress-policy.md](../platform/network-egress-policy.md) 单独定义。
