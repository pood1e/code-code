# Provider Access Targets

## Responsibility

`ProviderAccount` is the provider aggregate root. It owns the account identity,
credential grant reference, source reference, model catalog, and the callable
access targets for that account.

Access targets are account-local provider access paths. They describe how a run
can call the provider, but they are not persisted as child endpoint aggregates.

## External Fields

- `credential_grant_ref`: account-level credential binding used for execution
  and reference checks.
- `source_ref`: account-level source owner. Vendor and CLI sources carry
  `source_id`; custom sources do not.
- `access_targets`: callable targets under the account. A target is either
  `cli.cli_id` or `api.protocol` plus `api.base_url`.
- `access_targets.access_target_id`: account-local provider access target id.
- `access_targets.source_target_id`: source/catalog probe routing id.

## Implementation Notes

Legacy endpoint projections are synthesized from `access_targets` only at
runtime boundaries that still need endpoint-shaped contracts. Provider service
RPCs expose account views with access targets and no longer expose
`GetProviderSurfaceBindingProjection`.

Execution resolves by provider account id plus `access_target_id`, then freezes
the credential generation on the resolved binding. Model choice is owned by
profile/session/run model routing, not by the provider account.
