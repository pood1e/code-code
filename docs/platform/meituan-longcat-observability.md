# LongCat (Meituan) Token Usage Observability

## Responsibility

Collect today's token usage data from LongCat's console tokenUsage API and expose it as OTLP metrics, enabling per-model usage visibility in the provider observability dashboard.

## Ownership

`packages/platform-k8s/internal/providerservice/providerobservability` — LongCat token usage collector
`packages/platform-k8s/internal/supportservice/vendors/support` — vendor capability package registry

## Interface

**Metrics produced**

| Metric | Category | Description |
|--------|----------|-------------|
| `gen_ai.provider.usage.tokens.count` | USAGE | Token usage per model (`token_type=input|output`) |

**Labels**: `owner_kind`, `owner_id`, `vendor_id`, `provider_id`, `provider_surface_binding_id`, `model_id`, `resource=tokens`, `window=day`, `token_type`

**Collector**: `meituan-longcat-token-usage`
**Poll interval**: 3600s (minimum)

## Auth Mechanism

The LongCat console tokenUsage API (`https://longcat.chat/api/lc-platform/v1/tokenUsage`) is a console-plane endpoint that requires a **web session token** or equivalent management-plane credential. This token is stored in a dedicated management-plane credential.

The runner resolves this token from the provider's dedicated observability credential (`<provider_id>-observability`). The collector advertises the internal `bearer-session` adapter, so auth replacement uses the management-plane credential instead of the inference API key.

## Setup

### 1. Obtain the session token

Log in to `longcat.chat` and extract the session token from the browser's developer tools (Network tab → any authenticated request → `Authorization` header value, without the `Bearer ` prefix). This token may expire and need to be rotated periodically.

### 2. Store the observability credential

Use `UpdateProviderObservabilityAuthentication` with a vendor-specific session schema and an `access_token` value. The auth service owns credential material persistence through its material store. Do not create a Kubernetes Secret or a second vendor-specific storage path for this token.

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

- **Response format**: The parser in `vendor_observability_collector_meituan_parse.go` is a stub targeting the most likely JSON shapes (both camelCase and snake_case conventions). Once the actual `tokenUsage` response schema is confirmed via live testing, update `parseMeituanTokenUsageGaugeRows` to match the real field names.
- **`day` parameter**: Currently hardcoded to `today`. If the API supports date ranges or cumulative views, expose the parameter or add a separate profile.
- **Additional metrics**: Extend canonical families when new dimensions are required (e.g. `gen_ai.provider.usage.cost.*`).

## Related

- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_collector_meituan.go`
- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_collector_meituan_parse.go`
- `packages/platform-k8s/internal/providerservice/providerobservability/vendor_observability_runner_probe.go`
- `packages/platform-k8s/internal/egressauth/context.go` — `bearer-session` adapter id
