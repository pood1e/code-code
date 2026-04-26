# Provider Run Binding

## responsibility

`ProviderRunBinding` is the frozen provider/model/auth/access binding used by one submitted run. It makes runtime execution independent from later provider account, access target, model catalog, or credential changes.

## external fields

- `provider_id`
- `access_target_id`
- `runtime_cli_id`
- `oneof access`
  - `cli`
  - `api.protocol`
- `credential_grant_id`, `credential_generation`
- `runtime_url`, `resource_url`
- `materialization_key`
- `canonical_model_id`, `provider_model_id`, `source_model_id`, `model_ref`, `catalog_source`
- `resolved_at`

## implementation notes

Agent execution writes the binding into `AgentRunAuthRequirement`. Prepare jobs
and the runtime auth projection read only the frozen binding.

Runtime resolution treats the callable target as:

- CLI: `provider_id + access_target_id + model`
- API: `provider_id + access_target_id + protocol + model`

The frozen run binding should therefore capture only the minimal access target
shape needed by execution:

- CLI target only marks the CLI target branch
- common execution context carries `runtime_cli_id`
- API target carries `protocol`

`runtime_url` is the callable URL; `resource_url` is the OAuth resource
indicator/audience for the selected access target.
