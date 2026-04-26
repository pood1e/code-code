# platform-chat-service Kubernetes Base

## Responsibility

这组 manifests 负责把 `platform-chat-service` 作为 chat gRPC service 部署到 Kubernetes。

## Objects

- `ServiceAccount`
- `Deployment`
- `Service`

## Access Scope

`platform-chat-service` 不直接访问 platform CRDs 或 Secrets。
它通过内部 gRPC 调用：

- `platform-provider-service`
- `platform-agent-runtime-service`

## Runtime Settings

- `PLATFORM_CHAT_SERVICE_GRPC_ADDR=:8081`
- `PLATFORM_CHAT_SERVICE_PROVIDER_GRPC_ADDR=platform-provider-service:8081`
- `PLATFORM_CHAT_SERVICE_AGENT_RUNTIME_GRPC_ADDR=platform-agent-runtime-service:8081`
- `PLATFORM_DATABASE_URL`

`platform-chat-service` stores chat metadata and the chat-to-session binding in
Postgres. Turn queue state and run output stay in `platform-agent-runtime-service`
and the run event stream.
