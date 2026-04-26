# Domain State Boundary

## Decision

Platform product state is not modeled as Kubernetes custom resources by default.

Use Kubernetes resources only for Kubernetes-owned desired state and observable runtime
state: workloads, Jobs, Pods, Secrets, ConfigMaps, NetworkPolicy, and CRDs whose
primary users are Kubernetes controllers and operators.

Use Postgres for service-owned product/domain state that needs relational queries,
bounded pagination, product API semantics, or does not need Kubernetes admission,
watch, ownerReference, finalizer, or kubectl workflows.

## Rules

- Do not add a `controller-runtime` client facade that silently redirects CRD CRUD
  into Postgres.
- Do not create CRDs only to make service-owned rows visible to `kubectl`.
- Keep Postgres repositories domain-shaped; do not expose them as Kubernetes clients.
- Keep Kubernetes clients for actual Kubernetes resources and real CRDs.
- If a Postgres table feeds a Kubernetes-facing or API-facing read path, name it as a
  projection/read model and keep the write owner explicit.

## Current Ownership Line

The old Postgres-backed `controller-runtime` client facade has been removed.
Service-owned product state now uses explicit repositories instead of a client
that redirects CRUD into Postgres.

The migration now replaces each caller with an explicit owner API:

- `AgentSession`, `AgentSessionAction`, and `AgentRun`: `packages/session` and
  agent-runtime repositories own desired/status state.
- `CredentialDefinition` and OAuth sessions: auth-service repositories own state;
  Kubernetes Secrets carry credential material only.
- `ModelDefinition`: model-service owns canonical catalog rows through
  `models.PostgresRegistryStore`; management list paths read the
  Postgres read model directly.
- vendor identity/support and CLI definitions: support/catalog packages own static
  or service-owned reference data; they are not CRDs.

During that migration, controllers must use `resourceops.UpdateResource` or
`resourceops.UpdateStatus` for real Kubernetes resources so conflict handling remains
correct when objects move back to the Kubernetes API.
