# Temporal Workflows

## responsibility

Temporal owns durable orchestration for platform service workflows that need schedules, timers, retries, signals, queries, and resumable multi-step execution.

Domain services remain the owners of business truth:

- `platform-auth-service`: OAuth maintenance, credential readiness, OAuth callback driven flows
- `platform-provider-service`: provider connect, post-connect catalog/probe orchestration, provider observability schedules
- `platform-model-service`: model definition sync orchestration
- `platform-support-service`: CLI version sync and image build dispatch orchestration
- `platform-agent-runtime-service`: AgentRun execution orchestration

Temporal history is execution state only. Provider, credential, model, session, and AgentRun user-facing state is stored and projected by the owning service.

## external fields

- `TEMPORAL_ADDRESS`: Temporal frontend address
- `TEMPORAL_NAMESPACE`: Temporal namespace, default `default`
- `TEMPORAL_TASK_QUEUE`: service-owned task queue

Workflow IDs are deterministic domain IDs:

- `oauth-maintenance`
- `model-maintenance`
- `provider-observability-schedule`
- `provider-connect-{provider_id}`
- `provider-connect-session-{session_id}`
- `cli-runtime-image-build-{request_id}`
- `agent-run-{agent_run_resource_name}`

## implementation

- Use the official Temporal Go SDK for workflows, activities, workers, schedules, signals, queries, and retry policy.
- Register each service's workflows and activities in that service's worker startup.
- Keep workflow functions deterministic; side effects live in activities.
- Use Temporal Schedules for internal periodic service actions.
- Use Temporal Signals to advance workflows from OAuth callback and credential readiness events.
- Use activities to call gRPC services, update domain stores, publish domain events, and create or observe Kubernetes Jobs.
- Use Kubernetes Jobs only for execution that needs an isolated Pod, such as CLI image build and AgentRun execution.
- Publish workflow status changes as domain events for console SSE consumption; the frontend does not watch Temporal or Kubernetes workflow resources directly.
- Remove obsolete workflow CRDs, RBAC, vendored manifests, deploy waits, and resource watches in the same migration surface.
