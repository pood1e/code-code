# Platform Model Service

## responsibility

`platform-model-service` owns model registry query, model definition sync, and the model catalog source registry.

## external methods

- `ListModelDefinitions`
- `GetOrFetchCatalogModels`
- `FetchCatalogModels`
- `SyncModelDefinitions`

`ListModelDefinitions` is also mounted as an exact Connect HTTP procedure for browser model registry reads through `console-api`.

## implementation notes

Provider catalog orchestration lives in `platform-provider-service`. Model service does not persist provider aggregates; it resolves opaque `probe_id` catalog sources and returns catalog rows with `source_model_id` plus unified `ModelDefinition` to callers.

Catalog fetch requests may omit `auth_ref`. Concrete probe sources reject missing auth only when their discovery operation requires credential material.

Model definitions are persisted through `models.PostgresRegistryStore` in
Postgres and emit protobuf domain events through the shared outbox publisher.
`ListModelDefinitions` reads `platform_model_registry_entries` directly with SQL
filtering and pagination. Kubernetes access is limited to native coordination
leases; the service does not start a controller-runtime manager or cache.

Model catalog probes emit OpenTelemetry metrics through the process MeterProvider.
Application metrics are exported to the in-cluster OTel Collector over OTLP/gRPC
on port 4317; traces continue to use OTLP/HTTP on port 4318.
