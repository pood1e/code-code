## responsibility

Own vendor observability collector strategies behind an internal registry so callers only depend on `NewVendorObservabilityRunner`.

## key methods

`credentials.NewVendorObservabilityRunner`
uses registered vendor observability collectors when config does not inject overrides.

`credentials.DefaultVendorObservabilityCollectors`
returns all registered vendor collectors in stable order.

## implementation notes

Each vendor collector registers itself from its dedicated file.

Assembly and runtime code must not list concrete vendor collectors.

Collector result may carry one refreshed management-plane token; runner persists it back only when the resolved credential is the account-owned observability override.

Every active-query owner exports one generic auth usability gauge from probe outcomes:

- vendor API key: `gen_ai_provider_vendor_api_key_active_discovery_auth_usable`
- CLI OAuth: `gen_ai_provider_cli_oauth_active_discovery_auth_usable`

Every active-query owner also exports one last-outcome gauge for provider status projection:

- vendor API key: `gen_ai_provider_vendor_api_key_active_discovery_last_outcome`
- CLI OAuth: `gen_ai_provider_cli_oauth_active_discovery_last_outcome`
