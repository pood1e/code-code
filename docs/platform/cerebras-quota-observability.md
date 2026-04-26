## responsibility

Own `Cerebras` active quota query against `cloud.cerebras.ai` and project all accessible organizations into provider-account observability metrics.

## key methods

`credentials.NewCerebrasVendorObservabilityCollector`

## implementation notes

- collector uses `authjs.session-token` against `ListMyOrganizations`, `ListOrganizationEffectiveQuotas`, and `ListOrganizationUsage`
- collector fetches all returned organizations instead of storing one selected org on provider
- per-organization quota query is best-effort; probe fails only when every returned organization fails
- metric rows carry `org_id` and optional `org_name` labels so multi-org quota data stays distinguishable
- metric queries group by `org_id` when rendering Cerebras quota panels
