# platform-model-service

这组 manifests 部署 `platform-model-service`，作为模型目录与通用 model catalog discovery 的独立服务。

## responsibility

- 提供 `platform.model.v1.ModelService` gRPC API
- 读取与同步 `ModelDefinition`
- 执行 anonymous model catalog discovery
- auth-bound model catalog discovery 直接请求目标 HTTPS，由透明 egress 链路经过 Envoy 注入鉴权 header
- 通过 Temporal Schedule 触发内部 model maintenance background task

## runtime

- Deployment: `platform-model-service`
- Service: `platform-model-service:8080` HTTP trigger, `platform-model-service:8081` gRPC
- Temporal schedules:
  - `model-maintenance`
- Run-once actions:
  - `sync-model-definitions`

## config

- `PLATFORM_MODEL_SERVICE_NAMESPACE`
- `PLATFORM_MODEL_SERVICE_GRPC_ADDR=:8081`
- `PLATFORM_MODEL_SERVICE_HTTP_ADDR=:8080`
