# AgentRun Runtime Isolation

## Responsibility

`platform-agent-runtime-service` owns AgentSession and AgentRun control resources in `code-code`, and creates execution-only Kubernetes Jobs and PVCs in `code-code-runs`.

## External Fields

- `PLATFORM_AGENT_RUNTIME_SERVICE_NAMESPACE`: control-plane namespace.
- `PLATFORM_AGENT_RUNTIME_SERVICE_RUNTIME_NAMESPACE`: execution runtime namespace.
- `RUN_NAMESPACE`: release-time runtime namespace, default `${NAMESPACE}-runs`.

## Implementation Notes

- Runtime execution Jobs use `automountServiceAccountToken: false` and run under default-deny network policy.
- Runtime PVCs are owned by session/run resources; projected credential Secrets are label-owned by `platform-auth-service` and cleaned by AgentRun cleanup workflow.
- Runtime network access is default-deny and allows only DNS, Envoy egress, control-plane internal HTTP/gRPC, NATS, and OTel Collector OTLP HTTP.
