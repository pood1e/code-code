# Provider Service

## responsibility

`platform-provider-service` owns provider aggregate operations: provider CRUD, endpoint CRUD, provider connect orchestration, provider observability triggers, and provider model catalog discovery/binding triggers.

## external methods

The service exposes `platform.provider.v1.ProviderService` over internal gRPC and internal HTTP trigger actions for lightweight workflows. `console-api` calls gRPC directly for provider-domain management.

`ProviderService/ListVendors` is also mounted as an exact Connect HTTP procedure for browser reference reads through `console-api`.

Key methods:

- Provider catalog: list definitions, providers, endpoints, vendors, CLI definitions, vendor capability packages, CLI specialization packages.
- Provider mutations: update provider metadata, update authentication, update observability authentication, delete provider, endpoint create/update/delete.
- Provider flows: connect provider, read connect session, submit observability probe.
- Catalog maintenance: discover provider catalogs, bind provider catalogs.

## implementation notes

Provider service is stateless. Provider account and endpoint truth lives in Postgres; vendor and CLI identities are read from Kubernetes definitions, and vendor/CLI capability packages come from service registries.

Service-to-service calls use generated gRPC clients from `packages/proto`; provider service does not import auth/model service implementation packages or read their owned resources directly.

Kubernetes access uses a direct client for read and workflow submission paths; the service does not start a controller-runtime manager or cache.
