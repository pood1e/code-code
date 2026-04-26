# Platform Agent Runtime Service

## Responsibility

`platform-agent-runtime-service` 负责承接 `AgentSession` / `AgentRun` 的独立运行面。

## External Surface

- `platform.management.v1.AgentSessionManagementService`
  - `GetAgentSession`
  - `GetAgentSessionAction`
  - `CreateAgentSessionAction`
  - `StopAgentSessionAction`
  - `RetryAgentSessionAction`
  - `GetAgentRun`
  - `platform.management.v1.AgentSessionManagementService.StreamAgentRunOutput`

## Owned Controllers

- `AgentSession` reconciler
- `AgentSessionAction` reconciler
- `AgentRun` reconciler

## Implementation Notes

- OAuth authorization session 与 OAuth callback 由 `platform-auth-service` 承接。
- gRPC session 运行面实现集中在 `packages/platform-k8s/sessionapi`。
- `platform-agent-runtime-service` 直接组合 `agentsessions` controller、`agentsessionactions`、`agentruns` service。
- session setup/status 数据落点是 `packages/session` repo；agent-session management API 不创建或更新 session setup。
- controller `Requeue/RequeueAfter` 通过 `sessionapi.ReconcileScheduler` 调用 runtime HTTP trigger；requeue 按 owner/action coalesce。
- profile-backed session projection 通过 `platform-profile-service` gRPC 读取 profile、MCP、skill、rule。
- session runtime reference validation 通过 `platform-provider-service` gRPC 读取 provider endpoint 与 CLI definition。
- `AgentRun.containerImage` 通过 `platform-cli-runtime-service` gRPC 按 CLI identity + execution class 解析最新可用 runtime image；chat/profile 不配置 CLI version。
- `PLATFORM_AGENT_RUNTIME_SERVICE_CLI_OUTPUT_SIDECAR_IMAGE` 注入 `cli-output-sidecar` runtime image。
- model resolution 通过 `platform-model-service` gRPC 读取 model registry。
- HTTP action `prepare-agent-run-job` 接收 Temporal prepare activity 请求；需要写 workspace/home-state PVC 时，由 runtime service 创建短生命周期 Kubernetes `Job`，使用当前 `AgentRun.containerImage` 与 `/usr/local/bin/agent-prepare.sh`。
- HTTP action `cleanup-agent-run` 接收 Temporal cleanup activity 请求，只处理本 run 中 `cleanup=true` 的 prepare job。
- `sessionapi.SessionConfig.ActionRetryPolicy` 提供 action automatic retry 策略注入点；未注入时使用默认策略。
- 环境变量可选覆盖 action automatic retry 策略：
  - `PLATFORM_AGENT_RUNTIME_SERVICE_ACTION_RETRY_MAX_RETRIES`
  - `PLATFORM_AGENT_RUNTIME_SERVICE_ACTION_RETRY_BASE_BACKOFF`
  - `PLATFORM_AGENT_RUNTIME_SERVICE_ACTION_RETRY_MAX_BACKOFF`
- `AgentRun` workflow submit 由 controller 启动 Temporal workflow，Temporal activities 负责 prepare、execute、cleanup 对应的 Kubernetes Job；terminal result ingestion 走 NATS result projector。
- `platform-agent-runtime-service` 通过 retained run event bus 读取 `RunDeltaEvent` / `RunResultEvent`，并在 `StreamAgentRunOutput` gRPC stream 上按 event type 透传 proto；`console-api` 不直接消费 NATS。
