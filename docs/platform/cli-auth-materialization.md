# CLI Auth Materialization

## Summary

`CLIAuthMaterialization` 定义一个 CLI 某条 auth path 的 runtime materialization contract。

主线：

- 真实 credential 永远只给 Envoy auth processor
- 主容器只接收 placeholder auth artifact
- 主容器可接收非敏感 runtime projection，例如 `base_url`、`resource_url`
- OAuth 与 API key 都需要各自的 CLI-specific materialization
- Envoy auth processor 只校验 credential projection 已加载并可解析

## Responsibility

- 为一个 `cli_id` 的一种 auth path 声明稳定 `materialization_key`
- 声明该 auth path 需要哪些非敏感 runtime projection
- 声明该 auth path 的 `runtime_url` 来源
- 作为 execution adapter 到 CLI-specific auth bundle 的 dispatch contract

## Fields

- `materialization_key`
- `required_runtime_projections`
- `runtime_url_projection_kind`

## Implementation Notes

- `materialization_key` 只做 runtime dispatch，不进用户面
- `runtime_url_projection_kind=BASE_URL` 表示直接消费 provider endpoint `base_url`
- `runtime_url_projection_kind=RESOURCE_URL` 表示从 OAuth artifact 的 `resource_url` 解析 runtime URL
- 具体写哪些文件、env、settings、placeholder token，由 `deploy/agents/<cli>` 的 auth bundle 实现
- `oauth` 和每个 `api_key_protocol` 都需要自己的 `CLIAuthMaterialization`
- execution adapter 只做：
  - resolve active auth path
  - 挂 Envoy auth processor 可读取的 credential projection
  - 提供非敏感 runtime projection
  - 按 `materialization_key` 调用 CLI-specific bundle
- OAuth freshness 由 `oauth-maintenance` Temporal Schedule 与 auth-owned activities 维护
- API key path 在 Envoy auth processor 中只做本地 projection parse / load
