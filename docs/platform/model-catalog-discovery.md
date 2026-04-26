# Model Catalog Discovery

## responsibility

`platform-provider-service` owns provider-level catalog orchestration. `platform-model-service` owns the model catalog source registry and model registry reads.

## flow

- Provider service selects one provider-level endpoint target.
- Provider service calls `platform-model-service.GetOrFetchCatalogModels` for the normal path, or `FetchCatalogModels` when the caller explicitly wants a forced refresh.
- The request carries opaque `probe_id`, target metadata, and optional `auth_ref`.
- Model service resolves the registered source by `probe_id` and returns catalog rows with `source_model_id` plus unified `ModelDefinition`.
- Provider service converts the returned rows into its own catalog shape and persists the provider aggregate.

## implementation notes

Discovery is provider-level, not endpoint-level from the orchestration perspective. Model service does not own provider state or result purpose.

`auth_ref` is optional at the service contract level. Static catalogs and anonymous discovery do not require it; a concrete probe adapter validates it only when that probe needs credential material.
