# Egress Auth Context

## responsibility

`platform-auth-service` owns header rewrite policy execution and credential
material access. `egressauth` only names the internal metadata keys used by
Wasm, auth-service, and agent-session.

## external fields

- `x-code-code-credential-secret-namespace`
- `x-code-code-credential-secret-name`
- `x-code-code-target-hosts`
- `x-code-code-request-header-names`
- `x-code-code-header-value-prefix`
- `auth.code-code.internal/auth-policy-id`
- `auth.code-code.internal/request-header-rules-json`
- `auth.code-code.internal/response-header-rules-json`
- `auth.code-code.internal/run-id`
- `auth.code-code.internal/provider-account-surface-id`
- `agentrun.code-code.internal/run-id`

## implementation notes

- Auth-bound control-plane discovery sends placeholder auth headers through Envoy.
- AgentRun egress resolves auth context by runtime source through
  `agent-session`.
- AgentRun prepare asks support-service for `auth_policy_id`, then asks
  auth-service for the concrete header rewrite rules.
- Envoy removes all `x-code-code-*` auth routing headers before forwarding upstream.
- Credential material is read only by `platform-auth-service`.
- Simple header rewrite is YAML-defined in auth-service; complex rewrite is
  dispatched by auth-service adapter id.
