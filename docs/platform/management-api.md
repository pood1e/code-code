# Management API

## responsibility

`platform.management.v1` only keeps shared console-facing DTOs used by domain services.

## ownership

- Profile, MCP, skill, and rule management is owned by `platform-profile-service`.
- Provider, template, vendor, CLI, provider connect, provider catalog, and provider observability methods are owned by `platform-provider-service`.
- Credential and OAuth management is owned by `platform-auth-service`.
- Egress policy reads are owned by `platform-network-service`.
- Model registry and catalog discovery execution is owned by `platform-model-service`.

## implementation notes

`console-api` directly calls the owning domain service; there is no management facade service.
