# Provider Aggregate Root

## responsibility

`ProviderAccount` is the aggregate root for one user-configured LLM provider
connection.

It owns display identity, surface binding, credential grant reference, source
reference, model catalog, observability configuration, and account-local access
targets.

## external fields

- `provider_id`
- `display_name`
- `surface_id`
- `credential_grant_ref`
- `source_ref`
- `model_catalog`
- `access_targets[]`

An access target is a callable path under the account. It does not own model
selection defaults.

## implementation notes

Provider truth is stored by the provider service. Auth material remains owned
by auth-service. Provider stores only credential grant identity.

Model catalog discovery and binding write provider-owned catalog state.

Vendor and CLI presentation metadata comes from support resources and should
not be copied into provider account truth.

Endpoint-shaped projections are temporary internal runtime materializations and
should not be exposed as new public CRUD surfaces.
