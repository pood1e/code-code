# LongCat (Meituan) Token Usage Observability

## Responsibility

Collect today's token usage data from LongCat's console tokenUsage API and expose it as OTLP metrics, enabling per-model usage visibility in the provider observability dashboard.

## Ownership

`packages/platform-k8s/providerobservability` — LongCat token usage collector
`packages/platform-k8s/vendors/capabilitypackages` — vendor capability package registry

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

The runner resolves this credential via the `observability_credential_ref` field on `VendorCapabilityPackage`.

## Setup

### 1. Obtain the session token

Log in to `longcat.chat` and extract the session token from the browser's developer tools (Network tab → any authenticated request → `Authorization` header value, without the `Bearer ` prefix). This token may expire and need to be rotated periodically.

### 2. Create the Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: meituan-longcat-session
  namespace: code-code
type: Opaque
stringData:
  api_key: <REPLACE_WITH_SESSION_TOKEN>
```

### 3. Create the credential definition

```yaml
apiVersion: platform.code-code.internal/v1
kind: CredentialDefinition
metadata:
  name: meituan-longcat-session
  namespace: code-code
spec:
  credentialDefinition:
    credentialId: meituan-longcat-session
    displayName: LongCat Session Token
    kind: CREDENTIAL_KIND_API_KEY
    purpose: CREDENTIAL_PURPOSE_MANAGEMENT_PLANE
    vendorId: meituan-longcat
    secretSource:
      name: meituan-longcat-session
      apiKeyKey: api_key
```

### 4. Verify

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

- `packages/platform-k8s/providerobservability/vendor_observability_collector_meituan.go`
- `packages/platform-k8s/providerobservability/vendor_observability_collector_meituan_parse.go`
- `packages/platform-k8s/providerobservability/vendor_observability_runner_probe.go` — `resolveObservabilityToken`
- `packages/proto/vendor_capability_package/v1/vendor_capability_package.proto` — `observability_credential_ref`
