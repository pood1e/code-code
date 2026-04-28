# Credential Backfills

Credential backfill is the provider-owned path for persisting credential values
learned from management-plane probes, such as a resolved Google project ID or a
provider session cookie. It is not part of network routing, Istio policy, or
runtime response delivery.

## Ownership

- `supportservice` declares which values may be persisted on the relevant
  observability `activeQuery` through `credentialBackfills`.
- `providerservice` runs provider-specific collectors and filters collector
  output through the declared backfill rules.
- `authservice` is the only service that mutates credential material. Callers use
  `MergeCredentialMaterialValues`; they do not update Kubernetes Secrets directly.

## Invariants

- Raw HTTP header bags are never accepted as credential updates.
- A collector may persist only declared `credentialBackfills` values.
- Operator-supplied observability auth values are accepted only through the
  support-owned `activeQuery.inputForm` schema.
- The declaration names the source, source name, target material key, whether
  the value is required, and whether that persisted value may be read back by
  the collector on later runs.
- Credential material readback is default-deny. A caller must pass a
  `CredentialMaterialReadPolicyRef`, and authservice only returns keys declared
  by the referenced support-owned active query policy.
- `Set-Cookie` or other response credentials must be parsed by the owning
  provider adapter into an explicitly declared target key before persistence.
- Response header replacement is a separate redaction path. It may replace real
  response values with placeholders, but it must not return real credentials to
  callers.

## Current Shape

```text
CLI/vendor support YAML activeQuery.credentialBackfills
  -> provider observability collector output or declared HTTP response field
  -> providerservice declared-key filter/parser
  -> authservice.MergeCredentialMaterialValues
  -> encrypted credential material
```

```text
CLI/vendor support YAML activeQuery.inputForm
  -> console schema-rendered form
  -> providerservice schema validation and transient transforms
  -> authservice session credential merge
  -> encrypted credential material
```

```text
CLI/vendor support YAML activeQuery.materialReadFields or readable backfills
  -> providerservice active query policy ref
  -> authservice.ReadCredentialMaterialFields policy check
  -> encrypted credential material readback
```

Vendor collectors that need browser/session auth use the provider observability
credential (`<provider_id>-observability`) for replacement and backfill. API-key
collectors continue to use the provider surface credential.
