# Provider Protocols

## Summary

`llm_protocol.v1.Protocol` 是 API access target 的稳定协议标识。

它用于表达：

- API surface 支持哪些协议
- vendor package / template / custom API target 暴露的是哪种协议
- runtime 在解析、校验、展示时应如何识别 API target 语义

它不直接等价于某个具体 provider runtime 实现是否已经存在。

## Responsibility

`Protocol` 负责：

- 提供稳定、可序列化的协议枚举
- 为 `ProviderSurface.api.supported_protocols` 提供匹配键
- 为 API access target 的 `protocol` 提供一致的语义标识
- 为 template / vendor package / management API 提供统一协议名

它不负责：

- OAuth flow dispatch
- CLI identity
- provider runtime 的具体实现选择
- model discovery 逻辑本身

## Ownership

- source of truth: `packages/proto/provider/v1/provider.proto`
- generated contracts owner: `packages/go-contract`, `packages/agent-contract`
- protocol-specific runtime 是否存在，由 `packages/platform-k8s/providers/*` 单独拥有

## Interface

协议枚举的目标使用面：

- `ProviderSurface.api.supported_protocols`
- API access target `protocol`
- `ResolvedProviderModel.protocol`
- custom API key connect `protocol`

新增协议时必须满足：

- 枚举值是稳定语义，不绑定某个 vendor marketing name 变体
- 可以被 definition / endpoint / template / package 复用
- 不要求在同一个变更里补齐所有 runtime 实现，但必须明确哪些面已经可用

## Gemini

`PROTOCOL_GEMINI` 表示 Google Gemini native API surface。

当前落点：

- 可作为 provider surface / vendor package / template 的稳定协议标识
- Gemini API key provider runtime 使用 endpoint-local catalog
- provider model probe 支持 Gemini native `models.list`
- Google vendor API key path 可同时暴露 native Gemini 与 OpenAI-compatible endpoint
- `gemini-cli` provider definition 应使用该协议，而不是继续借用 `PROTOCOL_OPENAI_COMPATIBLE`

## Failure Behavior

- `PROTOCOL_UNSPECIFIED` 仍然是非法值
- surface / target 如果引用了未生成到当前代码的协议枚举，构建直接失败
- runtime 若尚未注册某个 protocol 的 provider 实现，应在使用该 protocol 的具体路径上显式失败，而不是回退成其它协议

## Extension Points

新增协议的标准落点：

1. 更新 `provider.proto` 中的 `Protocol`
2. 重新生成 `go-contract` / `agent-contract`
3. 更新相关 presets / templates / tests
4. 仅在需要实际调用或 discovery 时，再补 protocol runtime
