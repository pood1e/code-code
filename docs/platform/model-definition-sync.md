# Model Definition Sync

## Responsibility

`ModelDefinitionSync` 负责把 vendor-scoped public model collection 收敛成 support-managed canonical `ModelDefinition` rows。

## External Surface

- `platform.model.v1.ModelService.SyncModelDefinitions`
- provider support/service registry
- `platform_model_registry_entries`
- `platform_model_registry_observations`
- `platform.domain.catalog.*` protobuf domain events
- OpenRouter `GET /api/v1/models`
- GitHub Models `GET /catalog/models`
- ModelScope `GET /v1/models`
- Cerebras `GET /public/v1/models`
- NVIDIA Integrate `GET /v1/models`
- Hugging Face Hub `GET /api/models`

## Implementation Notes

- `platform-model-service` owns the sync runtime and registers a Temporal Schedule for recurring sync.
- Sync is stateless; collection snapshots only live in memory during one sync call.
- Durable truth is support-managed `platform_model_registry_entries` rows written by
  `models.PostgresRegistryStore`. The sync path writes the model-service
  read model directly and does not pretend these rows are apiserver CRs.
- Preset collectors run through platform Envoy egress.
- Vendor and CLI model catalog source implementations may use static package data, YAML-backed data, HTTP APIs, SDKs, or CLI/OAuth runtimes.
- Sync collects high-quality sources first, then merges lower-quality source observations into canonical `vendor_id + model_id` rows.
- Source observations are written to `platform_model_registry_observations` with `source_id`, `kind`, `is_direct`, `source_model_id`, `definition`, `badges`, and `pricing`.
- Each model catalog probe records OpenTelemetry metrics for run count, duration, discovered model count, last run timestamp, and outcome. Metrics use low-cardinality labels such as `probe_id`, `protocol`, `auth`, `response_kind`, `outcome`, and `error_kind`; credentials and URLs are not labels.
- Stale delete only removes support-managed definitions for configured vendors whose current collection succeeded and no longer contains the model.
