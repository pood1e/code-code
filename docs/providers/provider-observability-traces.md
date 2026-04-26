## responsibility

Provider observability traces show the provider quota probe call chain in Tempo.

## external fields

- `provider_account_id`: filters traces for one provider account.
- `provider_surface_binding_id`: narrows traces to the selected provider endpoint.
- `code_code.observability.outcome`: filters probe outcomes such as `auth_blocked`.

## implementation notes

- Trace filters are grouped by provider business flow, not by vendor.
