# Provider Model

## Responsibility

`platform-provider-service` owns provider account state and provider surface projections used by other services.

## Core Model

`ProviderSurface` is public capability metadata. It is stable platform metadata for one callable surface, such as `openai-compatible`, `gemini`, or a CLI OAuth surface. It declares `surface_id`, `kind`, API protocols when `kind = API`, credential kinds, and probe capabilities.

`ProviderSurfaceBinding` is the configured callable binding under one user provider account. It carries the selected `surface_id`, credential reference, runtime access shape, model catalog state, and source reference.

`Provider` is the user-owned aggregate. It contains one or more `ProviderSurfaceBinding` entries. Consumers select by:

- CLI surface: `provider_id + surface_id + model`
- API surface: `provider_id + surface_id + protocol + model`

## Removed Concepts

`definition` and `endpoint` are not domain names in this model. Existing code should not expose `ProviderSurface`, `ProviderSurfaceBinding`, `surface_id`, or endpoint-shaped directories. Use `ProviderSurface` and `ProviderSurfaceBinding` instead.

## Notes

Vendor, CLI, web, and custom API details are adapter-owned inputs to surface creation. Cross-service contracts should depend on provider and surface identities, not vendor or CLI ownership details.
