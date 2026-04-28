# Provider Model Auth Boundary

## Responsibility

Provider access is split into three owned resources:

- `ProviderAccount`: user-owned provider account for one surface.
- Access target: callable API/CLI target under one account.
- `CredentialGrant`: auth grant used by runtime bindings.

Runs never bind directly to mutable account defaults. A submitted run resolves
one access target, one credential grant, one provider-native model id, and one
canonical model ref into a frozen `ProviderRunBinding`.

## External Fields

`ProviderAccount` exposes provider id, display name, surface id, source ref,
custom API view when applicable, provider-level catalog, credential grant id,
and non-secret auth summary.

Access target exposes callable protocol/base URL or CLI runtime identity plus
credential grant reference. It does not expose catalog ownership.

`CredentialGrant` exposes grant id, display name, kind, purpose, vendor id, CLI
id, issuer, subject, scopes, resource URL, expiry, generation, material
readiness, and non-secret account summary.

`ProviderRunBinding` exposes provider account id, credential grant id,
credential generation, CLI/API target oneof, runtime/resource URL,
materialization key, provider model id, canonical model ref, catalog source,
and resolved timestamp.

`platform-support` exposes stable cross-service ids for vendor/CLI surfaces:
`surface_id`, `model_catalog_probe_id`, `quota_probe_id`, egress policy id, and
header rewrite policy id.

## Implementation Notes

Auth service owns credential grants and encrypted credential material. Provider service owns
accounts and access targets, and only reads material fields explicitly declared by support-owned observability policy. Model service owns
canonical model definitions and provider-native catalog queries. Model catalog
lookup uses `model_catalog_probe_id`; adapters register their own probe ids and
receive only credential identity for egress header replacement, not token
material or Kubernetes Secret payloads.

Header replacement runs at the L7 egress policy point. Static replacement uses
Gateway API `HTTPRoute` filters; dynamic credential-backed replacement should
move through Istio external authorization. Agent execution resolves and freezes
`ProviderRunBinding` before creating `AgentSessionAction` and `AgentRun`.

OAuth code flow uses PKCE, state, issuer/nonce checks where supported, exact
redirect URI matching, and RFC 8707 resource indicators when provider-specific
auth supports resource-scoped tokens. Deviations are documented on provider/CLI
supports.
