# Provider Definition Registry

## responsibility

- own the authoritative `LLMProviderSurface` read path
- expose provider definition list/get for management, connect, and status validation
- synthesize CLI-backed definitions from `CLISpecializationPackage`

## key methods

- `List(ctx)` returns all effective provider definitions
- `Get(ctx, surface_id)` returns one effective provider definition

## implementation

- API provider definitions come from builtin provider implementations
- CLI provider definitions are projected from CLI packages with OAuth enabled
- `LLMProviderSurfaceResource` is removed; no Kubernetes resource owns provider definitions
