# Platform Contract

这组文档定义 platform domain 的抽象边界。

## 文档入口

- [orchestration.md](./orchestration.md)
  作用：定义 platform control plane 主链、核心接口与全局规则。
- [state-store.md](./state-store.md)
  作用：定义 platform-owned state contract 与外部 domain owner 边界。
- [domain-state-boundary.md](./domain-state-boundary.md)
  作用：定义 Postgres domain state、Kubernetes resource 与 projection/read model 的边界。
- [agent-session.md](./agent-session.md)
  作用：定义 `AgentSession` 的抽象模型与 session state 语义。
- [agent-session-controller.md](./agent-session-controller.md)
  作用：定义 `AgentSession` controller 的 readiness/status 收敛边界。
- [agent-session-chat-view.md](./agent-session-chat-view.md)
  作用：定义 `AgentSession` 的用户层 `Chat/Turn` 视图关系。
- [agent-session-turn.md](./agent-session-turn.md)
  作用：定义面向 `AgentSession` 的用户层 `Turn` 模型。
- [agent-session-turn-output.md](./agent-session-turn-output.md)
  作用：定义用户层 `TurnOutput` 与 runtime `RunOutput` 的投影关系。
- [agent-session-observability.md](./agent-session-observability.md)
  作用：定义 session/turn timeline、duration、SSE 与 `Prometheus` 的观测投影关系。
- [timeline-events.md](./timeline-events.md)
  作用：定义 timeline event bus、replay 与 `Prometheus` metrics projection 的基础设施抽象。
- [agent-session-action.md](./agent-session-action.md)
  作用：定义 `AgentSession` 串行域内的 durable action 与 turn 输入调度主链。
- [agent-session-effective-config.md](./agent-session-effective-config.md)
  作用：定义 profile-backed session 的 effective config 投影与 `resource_config` materialization 主线。
- [agent-session-submit-mainline.md](./agent-session-submit-mainline.md)
  作用：定义当前 `CreateAgentSessionAction` 作为 `AgentSession` 内部 submit 主链的稳定语义。
- [platform-agent-runtime-service.md](./platform-agent-runtime-service.md)
  作用：定义 `AgentSession` 运行面独立 service 的 owner 边界。
- [agent-session-management-api.md](./agent-session-management-api.md)
  作用：定义 `AgentSession` 独立 gRPC management service 的 contract 边界。
- [agent-session-conditions.md](./agent-session-conditions.md)
  作用：定义 `AgentSessionCondition` 的稳定 vocabulary。
- [agent-run.md](./agent-run.md)
  作用：定义 `AgentRun` 作为 session 内一次 turn record 的抽象模型。
- [agent-run-controller.md](./agent-run-controller.md)
  作用：定义 `AgentRun` controller 的 execution status、workflow runtime 与 timeline 边界。
- [agent-run-conditions.md](./agent-run-conditions.md)
  作用：定义 `AgentRunCondition` 的稳定 vocabulary。
- [model-discovery.md](./model-discovery.md)
  作用：定义 provider observed catalog 的 `model discovery` 实现主链。
- [vendor-model-collection.md](./vendor-model-collection.md)
  作用：定义 vendor public model collection 作为 `ModelDefinitionSync` 采集输入的主链。
- [model-definition-sync.md](./model-definition-sync.md)
  作用：定义 `ModelDefinitionSync` 直接写 model-service registry read model 的主链。
- [model-source.md](./model-source.md)
  作用：定义 canonical model 与 `ModelSource` 的边界。
- [model-registry-authoritative-source.md](./model-registry-authoritative-source.md)
  作用：定义 registry/runtime 只承认 model-service owned `ModelRegistryEntry`。
- [provider-model-linkage-refactor.md](./provider-model-linkage-refactor.md)
  作用：定义 `provider` 与 `model` 链路的完整重构目标、owner 拆分与迁移顺序。
- [platform-k8s-smoke.md](./platform-k8s-smoke.md)
  作用：定义 `platform-k8s` 的最小 cluster smoke test。
- [platform-k8s-package-model.md](./platform-k8s-package-model.md)
  作用：定义 `platform-k8s` package 边界与 ownership。
- [backend-aggregate-mainline.md](./backend-aggregate-mainline.md)
  作用：定义后端 aggregate / repository / service 的统一主链。
- [provider endpoint-resource.md](./provider endpoint-resource.md)
  作用：定义 `ProviderSurfaceBinding` 的 proto / resource / status 主线。
- [provider-account-projection.md](./provider-account-projection.md)
  作用：定义 `Provider` 读模型与 account-level mutation 主线。
- [credential-resource.md](./credential-resource.md)
  作用：定义 `Credential` 写入模型、CRD/Secret 映射与更新主线。
- [provider-connect-mainline.md](./provider-connect-mainline.md)
  作用：定义 `providerconnect` 的 command / target / session 主线。
- [agent-provider-binding.md](./agent-provider-binding.md)
  作用：定义 `AgentProviderBinding` 抽象。
- [agent-profile.md](./agent-profile.md)
  作用：定义 `AgentProfile` 抽象。
- [execution-class.md](./execution-class.md)
  作用：定义 `ExecutionClass` 作为 CLI container variant selector 的抽象。
- [mcp-server.md](./mcp-server.md)
  作用：定义 `MCPServer` 抽象。
- [skill.md](./skill.md)
  作用：定义 `Skill` 抽象。
- [rule.md](./rule.md)
  作用：定义 `Rule` 抽象。
- [cli-output-sidecar.md](./cli-output-sidecar.md)
  作用：定义 CLI raw stream 解析 sidecar、pod-local gRPC 与 accumulator 主线。
- [postgres-state-store.md](./postgres-state-store.md)
  作用：定义 Postgres 作为 platform state adapter 的边界。
- [infrastructure.md](./infrastructure.md)
  作用：定义 Postgres、NATS JetStream、Prometheus、Grafana 的基础设施边界。
- [istio-observability.md](./istio-observability.md)
  作用：定义 Istio mesh metrics/traces 接入现有 observability stack 的边界。

## 阅读顺序

1. 先看 `orchestration.md`
2. 再看 `state-store.md`
3. 然后按资源阅读 `agent-session.md`、`agent-session-controller.md`、`agent-session-chat-view.md`、`agent-session-turn.md`、`agent-session-turn-output.md`、`agent-session-observability.md`、`timeline-events.md`、`agent-session-action.md`、`agent-session-submit-mainline.md`、`agent-run.md`、`agent-run-controller.md`、`agent-provider-binding.md`、`agent-profile.md`、`execution-class.md`、`mcp-server.md`、`skill.md`、`rule.md`、`cli-output-sidecar.md`
4. 再看 `agent-session-conditions.md`、`agent-run-conditions.md`、`model-discovery.md`、`vendor-model-collection.md`、`model-definition-sync.md`、`model-source.md`、`model-registry-authoritative-source.md`、`provider-model-linkage-refactor.md`、`platform-k8s-smoke.md`、`backend-aggregate-mainline.md`、`provider endpoint-resource.md`、`provider-account-projection.md`、`credential-resource.md` 与 `provider-connect-mainline.md`
5. 最后看 `postgres-state-store.md` 与 `infrastructure.md`
