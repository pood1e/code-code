# Platform Agent Runtime Service Kubernetes Base

## Responsibility

这组 manifests 负责把 `platform-agent-runtime-service` 作为 agent run 运行控制面部署到 Kubernetes。

## Objects

- `ServiceAccount`
- `CustomResourceDefinition/AgentRunResource`
- `Role`
- `RoleBinding`
- `Deployment`
- `Service`
- runtime namespace `Role`
- runtime namespace `RoleBinding`
- runtime namespace `NetworkPolicy/agent-run-*`

## Access Scope

`platform-agent-runtime-service` 在 control namespace 只管理 `AgentRunResource` 这个 Kubernetes-owned runtime CRD 与 resource ConfigMap；`AgentSession` 和 `AgentSessionAction` 是服务产品状态，走 Postgres repository。profile/provider/model owned 配置分别通过对应 service gRPC 读取，runtime credential Secret 由 `platform-auth-service` 投影。

- `agentrunresources`
- `leases`
- `configmaps`
- `persistentvolumeclaims`

runtime namespace：

- `jobs`
- `persistentvolumeclaims`
- `secrets`

## Runtime Settings

- `PLATFORM_AGENT_RUNTIME_SERVICE_GRPC_ADDR=:8081`
- `PLATFORM_AGENT_RUNTIME_SERVICE_HTTP_ADDR=:8080`
- `PLATFORM_AGENT_RUNTIME_SERVICE_NAMESPACE` 从 Pod namespace 注入
- `PLATFORM_AGENT_RUNTIME_SERVICE_RUNTIME_NAMESPACE=code-code-runs`
- `PLATFORM_AGENT_RUNTIME_SERVICE_PROFILE_GRPC_ADDR=platform-profile-service:8081`
- `PLATFORM_AGENT_RUNTIME_SERVICE_PROVIDER_GRPC_ADDR=platform-provider-service:8081`
- `PLATFORM_AGENT_RUNTIME_SERVICE_CLI_RUNTIME_GRPC_ADDR=platform-cli-runtime-service:8081`
- `PLATFORM_AGENT_RUNTIME_SERVICE_MODEL_GRPC_ADDR=platform-model-service:8081`
- `PLATFORM_AGENT_RUNTIME_SERVICE_CLI_OUTPUT_SIDECAR_IMAGE=code-code/cli-output-sidecar:0.0.0`
- `PLATFORM_AGENT_RUNTIME_SERVICE_TIMELINE_NATS_URL` 指向 retained NATS bus，同时供 timeline sink 与 run output stream 读取
- `PLATFORM_AGENT_RUNTIME_SERVICE_TIMELINE_NATS_SUBJECT_PREFIX` 指定 realtime event subject prefix

## Implementation Notes

- `AgentRun` execution is submitted as a Temporal workflow. Temporal activities
  create bounded Kubernetes Jobs in the runtime namespace for prepare, execute,
  and cleanup steps.
