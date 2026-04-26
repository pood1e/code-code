# Mistral Billing Observability

## Responsibility

Collect token usage data from Mistral AI's console billing API and expose it as OTLP metrics, enabling per-model usage visibility in the provider observability dashboard.

## Ownership

`packages/platform-k8s/providerobservability` — Mistral billing collector
`packages/platform-k8s/vendors/capabilitypackages` — vendor capability package registry

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

The runner resolves this credential via the `observability_credential_ref` field on `VendorCapabilityPackage`, which is a new generic mechanism for vendors whose observability endpoint uses different auth than their inference API key.

## Setup

### 1. Obtain the session token

Log in to `console.mistral.ai` and extract the session token from the browser's developer tools (Network tab → any authenticated request → `Authorization` header value, without the `Bearer ` prefix). This token may expire and need to be rotated periodically.

### 2. Create the Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mistral-billing-session
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
  name: mistral-billing-session
  namespace: code-code
spec:
  credentialDefinition:
    credentialId: mistral-billing-session
    displayName: Mistral Billing Session
    kind: CREDENTIAL_KIND_API_KEY
    purpose: CREDENTIAL_PURPOSE_MANAGEMENT_PLANE
    vendorId: mistral
    secretSource:
      name: mistral-billing-session
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

- **Response format**: The parser in `vendor_observability_collector_mistral_parse.go` is marked as a stub. Once the actual `billing/v2/usage` response schema is confirmed via live testing, update `parseMistralBillingGaugeRows` to match the real field names.
- **Additional metrics**: Extend canonical families when new dimensions are required (e.g. `gen_ai.provider.usage.cost.*`).
- **Token refresh**: If Mistral introduces an OAuth flow for the billing API, migrate the credential kind from `API_KEY` to `OAUTH` and implement an authorizer — no change to the collector or YAML structure is needed.

## Related

- `packages/platform-k8s/providerobservability/vendor_observability_collector_mistral.go`
- `packages/platform-k8s/providerobservability/vendor_observability_collector_mistral_parse.go`
- `packages/platform-k8s/providerobservability/vendor_observability_runner_probe.go` — `resolveObservabilityToken`
- `packages/proto/vendor_capability_package/v1/vendor_capability_package.proto` — `observability_credential_ref`
