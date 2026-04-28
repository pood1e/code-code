# Mistral Billing Observability

## Responsibility

Collect token usage data from Mistral AI's console billing API and expose it as OTLP metrics, enabling per-model usage visibility in the provider observability dashboard.

## Ownership

`packages/platform-k8s/internal/providerservice/providerobservability` — Mistral billing collector
`packages/platform-k8s/internal/supportservice/vendors/support` — vendor capability package registry

## Interface

**Metrics produced**

| Metric | Category | Description |
|--------|----------|-------------|
| `gen_ai.provider.usage.tokens.count` | USAGE | Token usage per model (`token_type=input|output`) |

**Labels**: `owner_kind`, `owner_id`, `vendor_id`, `provider_id`, `provider_surface_binding_id`, `model_id`, `resource=tokens`, `window=day`, `token_type`

**Collector**: `mistral-billing`
**Poll interval**: 3600s (minimum)

## Auth Mechanism

The Mistral console billing API (`https://console.mistral.ai/billing/v2/usage`) requires a **web session token** obtained by logging in to `console.mistral.ai`. This token is different from the inference API key and must be stored in a dedicated management-plane credential.

The runner resolves this token from the provider's dedicated observability credential (`<provider_id>-observability`). The active-query collector advertises the internal `bearer-session` adapter, so auth replacement and any future backfill use the management-plane credential instead of the provider's inference API key.

## Setup

### 1. Obtain the session token

Log in to `console.mistral.ai` and extract the session token from the browser's developer tools (Network tab → any authenticated request → `Authorization` header value, without the `Bearer ` prefix). This token may expire and need to be rotated periodically.

### 2. Store the observability credential

Use the provider details dialog's observability auth action for Mistral, or call `UpdateProviderObservabilityAuthentication` with `schema_id=mistral-billing-session`, `required_keys=["access_token"]`, and `values.access_token=<token>`.

The auth service owns credential material persistence through its material store. Do not create a Kubernetes Secret or a second vendor-specific storage path for this token.

### 3. Verify

Apply the resources and trigger a manual probe. Check that `gen_ai_provider_usage_tokens_count{token_type=~"input|output"}` appears in Prometheus. Total tokens should be derived in query via `sum(input, output)`.

## Failure Behavior

| Condition | Outcome |
|-----------|---------|
| Token empty | `auth_blocked` |
| Token expired / 401 | `auth_blocked` |
| Network error | `failed` |
| Response format mismatch | `failed` (with raw body in error) |
| Credential not found | `failed` |

The probe backs off for 5 minutes on failure and 60 minutes after a successful execution.

## Extension Points

- **Response format**: The parser in `vendor_observability_collector_mistral_parse.go` is marked as a stub. Once the actual `billing/v2/usage` response schema is confirmed via live testing, update `parseMistralBillingGaugeRows` to match the real field names.
- **Additional metrics**: Extend canonical families when new dimensions are required (e.g. `gen_ai.provider.usage.cost.*`).
- **Token refresh**: If Mistral introduces an OAuth flow for the billing API, migrate the credential kind from `API_KEY` to `OAUTH` and implement an authorizer — no change to the collector or YAML structure is needed.

## Related

- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_collector_mistral.go`
- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_collector_mistral_parse.go`
- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_runner_probe.go`
- `packages/platform-k8s/internal/egressauth/context.go` — `bearer-session` adapter id
