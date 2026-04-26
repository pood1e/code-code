# Console API Kubernetes Base

## Responsibility

这组 manifests 负责把 `console-api` 作为 browser-facing HTTP BFF 部署到 Kubernetes。

## Objects

- `ServiceAccount`
- `Deployment`
- `Service`

## Access Scope

`console-api` 不直接访问 platform CRDs 或 Secrets。
它通过内部 gRPC 或 Connect 调用：

- `platform-provider-service`
- `platform-profile-service`
- `platform-network-service`
- `platform-auth-service`
- `platform-chat-service`

`/api/chats*` 由 `console-api` 作为 browser HTTP/SSE BFF 暴露，内部通过 gRPC 调用 `platform-chat-service`。
`/api/connect/platform.model.v1.ModelService/ListModelDefinitions` 代理到 `platform-model-service`。
`/api/connect/platform.provider.v1.ProviderService/ListVendors` 代理到 `platform-provider-service`。

## Runtime Settings

- `CONSOLE_API_ADDR=:8080`
- `CONSOLE_API_MODEL_CONNECT_BASE_URL=http://platform-model-service:8080`
- `CONSOLE_API_PROVIDER_CONNECT_BASE_URL=http://platform-provider-service:8080`
- `CONSOLE_API_PROVIDER_GRPC_ADDR=platform-provider-service:8081`
- `CONSOLE_API_PROFILE_GRPC_ADDR=platform-profile-service:8081`
- `CONSOLE_API_EGRESS_GRPC_ADDR=platform-network-service:8081`
- `CONSOLE_API_AUTH_GRPC_ADDR=platform-auth-service:8081`
- `CONSOLE_API_CHAT_GRPC_ADDR=platform-chat-service:8081`
