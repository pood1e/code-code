# Console API

本文定义 `console-api` 的抽象边界。  
error mapping 见 [error-mapping.md](./error-mapping.md)。
chat route 见 [agent-session-routes.md](./agent-session-routes.md)。

## Responsibility

- `console-api` 是面向 `console-web` 的 browser-facing REST JSON BFF。
- 它只拥有 HTTP transport、JSON mapping、SSE surface 和错误映射。
- 它不承载业务逻辑，不直接访问 Kubernetes API、platform CRDs 或 Secrets。

## External Surface

- browser-facing `/api/*` REST JSON routes
- OAuth session 相关 HTTP / SSE surface
- 到 `platform.management.v1` 的 gRPC request / response mapping
- 多 upstream BFF 适配

## Implementation Notes

- `console-web -> console-api -> upstream gRPC services -> platform-k8s` 是唯一主链。
- `internal/server` 负责 server 组装与 route registration，`internal/platformclient` 是唯一 upstream gRPC adapter。
- upstream 适配见 [platform-client.md](./platform-client.md)。
- 写路径或 stateful flow 按 `internal/<domain>/handlers.go + service.go` 拆分。
- 只读 reference-data list route 统一收敛到 `internal/referencedata/`，避免为每个 list-only surface 保留单独目录。
- error mapping 只依赖 gRPC status code；5xx 对外统一为 `"internal server error"`。
