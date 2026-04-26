# provider catalogs

## responsibility

`providercatalogs` owns endpoint-level model catalog binding for providers.

It materializes model-service catalog output onto `ProviderSurfaceBinding.runtime.catalog` and keeps endpoint-local provider model ids bound to canonical model refs.

## external methods

- `CatalogMaterializer.MaterializeProvider(ctx, provider)`
- `BindingSyncer.SyncAll(ctx)`

## implementation notes

- `modelservice` owns catalog probe resolution, probing support, static catalog selection, and probe execution.
- Provider service supplies opaque `probe_id`, endpoint target identity, and credential ref only when it needs to materialize endpoint catalog data.
- Endpoint `source_ref` selects the catalog source; provider display views may derive `vendor_id` from `source_ref` only for vendor-backed endpoints.
- `ProviderModelCatalogEntry` is the provider-side association from endpoint-local `provider_model_id` to canonical `model_ref`.
- Known model-side vendors do not receive provider endpoint `base_url`; model-service sources own their probe URL.
- Custom API-key endpoints may pass `base_url` as target input because the URL is user-owned endpoint configuration.
- Model probing concurrency is controlled by modelservice Kubernetes `Lease` keyed by the registered probe id or source-specific concurrency key.
