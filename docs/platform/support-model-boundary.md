# Support Model Boundary

## Responsibility

- `platform-support-service` exposes public resource metadata, routing policy
  ids, and provider/CLI/vendor observability profiles.
- Source-specific credential/header rewrite details stay behind support
  adapters and are not returned to network/session domains.
- `provider.v1.ProviderSurface` owns stable provider surface semantics.
- Cross-service runtime wiring ids are surface bindings, not source identity
  fields.

## Boundary

`platform.support.v1.CLI` exposes:

- source identity and presentation: `cli_id`, `display_name`, `icon_url`,
  `vendor_id`, docs links
- public auth/runtime affordances: OAuth flow, API key protocol support,
  runtime capabilities, container images
- OAuth provider binding ids: `surface_id`, `model_catalog_probe_id`,
  `quota_probe_id`, egress/header policy ids

`platform.support.v1.Vendor` exposes:

- source identity and presentation: `vendor`
- API surface bindings for vendor-spec API connect
- public API surface binding ids and provider card metadata

`ResolveProviderCapabilities` returns resolved runtime wiring:

- `egress_policy_id`
- `auth_policy_id`
- `observability`
- `model_catalog_probe_id`
- `quota_probe_id`
- `auth_materialization_key`

It does not return target hosts, path rules, credential material, header
replacement templates, or vendor/CLI ownership internals. Response-header
metric mappings are returned as `observability.v1.ObservabilityCapability`,
because support owns provider-specific header semantics.

The following are binding fields, not source identity fields:

- `surface_id`
- `model_catalog_probe_id`
- `quota_probe_id`
- `egress_policy_id`
- `header_rewrite_policy_id`

## Implementation Notes

- Provider list/read paths should join `ProviderAccount` with `ProviderSurface`,
  not vendor or CLI identity directly.
- Credential account summary is a separate auth read surface and must not be
  part of provider list assembly.
- Support registries may synthesize default bindings from static data while the
  proto shape is being adopted.
- Concrete egress rules live in `platform-egress-service`.
- Concrete header rewrite rules live in `platform-auth-service`.
- Concrete runtime HTTP telemetry declarations live in support-owned
  observability profiles. Support syncs them to `platform-egress-service`
  after startup; Istio Telemetry and OTel Collector own collection and metric
  conversion.
