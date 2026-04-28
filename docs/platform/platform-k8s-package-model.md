# Platform K8s Package Model

这份文档定义 `packages/platform-k8s` 的 Go package 级抽象边界与 ownership。

## Goal

`platform-k8s` 负责把 platform domain contract 映射到 Kubernetes resources、service runtimes 与 platform adapters。

## Layout

顶层只保留稳定入口：

- `api/v1alpha1`: Kubernetes CRD API types。
- `cmd/<binary>`: 可部署二进制入口。
- `internal`: platform-k8s 内部实现包。
- `scheme.go`: 对外暴露 `AddToScheme`，避免调用方 import 内部实现。

`internal` 按服务 ownership 与跨服务机制分组：

- `internal/authservice`: auth service、credential management、OAuth session、egress auth。
- `internal/modelservice`: model service、canonical model registry、model source collection。
- `internal/providerservice`: provider service、provider aggregate、provider connect、provider catalog、provider observability。
- `internal/agentruntime`: agent runtime service、AgentSession/AgentRun controllers、session action、timeline、runtime workflows。
- `internal/cliruntimeservice`: CLI runtime service、CLI version discovery and image build runtime。
- `internal/profileservice`: profile service、agent profile、MCP server、rule、skill stores。
- `internal/supportservice`: support service、CLI/vendor static reference data、provider surfaces、templates。
- `internal/egressservice`: egress policy service, network-owned Kubernetes resources, and runtime egress telemetry projection。
- `internal/notificationdispatcher` / `internal/wecomcallback`: standalone notification adapters。
- `internal/platform`: shared platform mechanics such as state, telemetry, Temporal client setup, domain events, outbound HTTP, resource helpers, run-event consumers, and test helpers。

## Ownership Rules

- `cmd/*` only wires configuration, transports, clients, workers, and service startup.
- Service root packages own their gRPC/HTTP service implementation and service-local orchestration registration.
- Domain state stays with the package that owns the behavior:
  `internal/profileservice/agentprofiles` owns `platform_profiles`,
  `internal/providerservice/providers` owns `platform_providers`,
  `internal/modelservice/models` owns canonical model registry state,
  and `internal/authservice/credentials` owns credential material readiness.
- Static reference data is owned by `internal/supportservice` subpackages; it is not runtime truth.
- `internal/platform/*` may provide mechanics only. It must not define product domain contracts or become a generic catch-all for service behavior.
- Other repo packages must call platform through generated service contracts. They must not import `packages/platform-k8s/internal/*`.
