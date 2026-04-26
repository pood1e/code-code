# Support Model Boundary

## Responsibility

- `platform-support-service` exposes public resource metadata and opaque
  capability ids.
- Source-specific capability details stay behind support adapters and are not
  returned to network/auth/session domains.
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

`ResolveProviderCapabilities` returns only opaque ids:

- `egress_policy_id`
- `auth_policy_id`
- `header_metric_policy_id`
- `model_catalog_probe_id`
- `quota_probe_id`
- `auth_materialization_key`

It does not return target hosts, path rules, header names, replacement
templates, response-header mappings, or vendor/CLI ownership.

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
- Concrete egress rules live in `platform-network-service`.
- Concrete header rewrite rules live in `platform-auth-service`.
- Concrete passive header metric rules live in agent runtime/session
  observability.
