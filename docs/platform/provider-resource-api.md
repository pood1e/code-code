# Provider Resource API

## responsibility

Provider-facing APIs should separate three concerns:

- `ProviderSurface`: stable provider surface contract
- `VendorResource` and `CLIResource`: presentation and integration metadata
- `ProviderAccount`: tenant-owned configuration
- `ProviderSurfaceBinding`: internal runtime materialization, not the primary external consumer object

`ProviderSurface`, `Vendor`, and `CLI` definitions are owned by
`platform-support-service` and exposed as support protobuf resources. Provider
runtime code may implement a surface, but it is not the external registry owner.

`ProviderSurface` is currently the surface-shaped contract in code. It answers
"how this provider is used". It owns:

- `surface_id`
- `display_name`
- `kind` (`api / cli / web`)
- `supported_credential_kinds`
- provider capabilities such as model override and probe support
- probe declarations:
  - `probes.model_catalog.method`
  - optional `probes.quota.schema_id`
  - optional `probes.quota.args[]`

`supported_protocols` is not a common field semantically. It is only meaningful
when `kind=api`. CLI and web surfaces must not declare protocols.

One surface owns exactly one model-catalog probe path and one quota/active-query
path. Probe ownership is by surface, not by endpoint and not by protocol.

`probes.model_catalog.method` is contract-level and currently supports three
execution styles:

- `PROTOCOL_BEST_EFFORT`: modelservice probes by selected protocol
- `STATIC`: modelservice resolves a static catalog adapter
- `ADAPTER`: modelservice dispatches to a registered adapter

Provider-facing code should not branch on vendor-specific model discovery logic.
That adaptation belongs in modelservice.

`probes.quota.args[]` is also contract-level. Any management or web form that
collects quota-probe session material must render from this proto contract
rather than from vendor-specific switch statements.

If one surface does not require extra quota session material, it should leave
`probes.quota.schema_id` empty and `probes.quota.args[]` empty. Callers should
interpret that as "no dedicated quota auth form".

`VendorResource` is optional. A provider account may be created directly against
an API surface with only `api_key + base_url + protocol`. That custom API path:

- does not require `vendor_id`
- resolves the target surface from the selected protocol
- supports best-effort model catalog probing
- does not create canonical model bindings during probe

Connect-time API input is intentionally split into two explicit shapes:

- `vendor_spec_api`
- `custom_api`

This split belongs only to create/connect input. The read-side consumer
contracts remain unified:

- `ProviderSurface`
- `ProviderAccount`
- `ProviderSurfaceBinding`
- `ProviderRunBinding`

`ProviderRunBinding` should also stay target-shaped rather than endpoint-
shaped. It should carry `provider_id` plus one access target:

- `cli { cli_id }`
- `api { protocol }`

It should not flatten `access_target_id`, `cli_id`, and `protocol` into one
top-level record.

`VendorResource` and `CLIResource` answer "who provides this" and "how this is integrated". They should share one common presentation block for:

- display name
- icon URL
- website URL
- description

Typed resources then add their own fields:

- `VendorResource`: vendor aliases
- `CLIResource`: vendor id, runtime/container metadata

One vendor may expose multiple surfaces. One vendor may also expose multiple
CLIs. `ProviderAccount` should reference those resources by id. It should not
inline brand assets or credential summaries.

## external fields

- `ProviderAccount`: `provider_id`, `display_name`, `surface_id`, `credential_grant_id`, `source_ref`, optional `custom_api`, model catalog.
- `ProviderConnectSession`: session id, OAuth session id, display name, authorization URL, `source_ref`, `connect_shape_kind`, account, status conditions.
- `ProviderObservabilityProbe`: provider ids, trigger, outcome, workflow id.
- `CredentialGrant.Refresh`: grant id, refresh controls, refresh outcome.

## implementation notes

The provider read path should not call auth, vendor, or CLI services to decorate `ProviderAccount` rows. The web console should join:

- `ProviderAccount + ProviderSurface`
- `ProviderAccount.source_ref(kind=vendor) -> VendorResource`
- `ProviderAccount.source_ref(kind=cli) -> CLIResource`

The surface list/read path should go through `platform-support-service`, not
`platform-provider-service`.

`ProviderSurface` remains free of vendor and CLI presentation metadata.
Support registries may bind vendors and CLIs to one surface for connect, model
probe, or quota probe flows, but those bindings are internal wiring rather than
the surface API itself.

`ProviderSurfaceBinding` should continue to exist only as an internal runtime
materialization detail until the runtime path is fully collapsed onto surface-
owned configuration. New external consumers should not be built around endpoint
selection.

Internal runtime callers that still need materialized endpoint data should use
dedicated provider-service runtime RPCs rather than public list/get views. That
keeps endpoint shape out of public consumer contracts while preserving the
existing execution path for agent preparation and auth projection.
