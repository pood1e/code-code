# Platform Model Service

## responsibility

`platform-model-service` owns model registry query, model definition sync, and the model catalog source registry.

## external methods

- `ListModelDefinitions`
- `GetCatalogModels`
- `ResolveModelRef`
- `GetModelDefinition`
- `SyncModelDefinitions`

`ListModelDefinitions` is also mounted as an exact Connect HTTP procedure for browser model registry reads through `console-api`.

## implementation notes

Provider catalog orchestration lives in `platform-provider-service`. Model service does not persist provider aggregates; it resolves opaque `probe_id` catalog sources and returns catalog rows with `source_model_id` plus unified `ModelDefinition` to callers.

Catalog fetch requests may omit `auth_ref`. Concrete probe sources reject missing auth only when their discovery operation requires credential material.

Model definitions are persisted through `models.PostgresRegistryStore` in
Postgres and emit protobuf domain events through the shared outbox publisher.
`ListModelDefinitions` reads `platform_model_registry_entries` directly with SQL
filtering and keyset-first pagination (`vendor_id`,`model_id` continuation token;
legacy offset token is still accepted for compatibility). Kubernetes access is limited to native coordination
leases; the service does not start a controller-runtime manager or cache.
`SyncModelDefinitions` submits `platform.model.maintenance` on Temporal, and the
Temporal activity owns the actual sync execution path.

Internal trigger actions (`/internal/actions/*`) are disabled by default.
Set `PLATFORM_MODEL_SERVICE_INTERNAL_ACTION_TOKEN` and use
`Authorization: Bearer <token>` to enable and call them.

`/readyz` reflects dependency health instead of process liveness only:
Postgres ping + Temporal health check are required; NATS JetStream is included
when `PLATFORM_MODEL_SERVICE_DOMAIN_EVENTS_NATS_URL` is configured.

Model catalog probes emit OpenTelemetry metrics through the process MeterProvider.
Model-service also emits query latency/error, catalog cache outcome, refresh-budget wait, and sync submission duration metrics.
Application metrics are exported to the in-cluster OTel Collector over OTLP/gRPC
on port 4317; traces continue to use OTLP/HTTP on port 4318.
