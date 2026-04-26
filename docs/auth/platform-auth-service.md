## responsibility

`platform-auth-service` owns auth-material writes, OAuth authorization sessions, and auth execution actions.

It is the only runtime that creates, updates, deletes, refreshes, enriches, or reads auth-backed `CredentialDefinition`, `OAuthAuthorizationSession`, and Secret data.

Other platform services use auth-service gRPC actions and do not read credential Secret material directly.

## external actions

- `create-api-key-credential`
- `update-api-key-credential`
- `create-session-credential`
- `update-session-credential`
- `create-oauth-credential`
- `update-oauth-credential`
- `import-oauth-credential`
- `rename-credential`
- `delete-credential`
- `ensure-oauth-fresh`
- `refresh-oauth-due`
- `scan-oauth-sessions`
- `probe-provider-observability`
- `get-credential-account-summary`
- `start-oauth-authorization-session`
- `get-oauth-authorization-session`
- `cancel-oauth-authorization-session`
- `record-oauth-code-callback`

## implementation notes

API key, session, and OAuth credentials use separate write and runtime handlers instead of a generic `kind` switch in the auth orchestration path.

The service is stateless: service-owned Postgres state and Secrets are the source of truth for auth data; Kubernetes resources stay Kubernetes-owned.

The service owns bounded background tasks for scheduled refresh and OAuth session scans. Temporal Schedules trigger those tasks through service-owned workflows/actions.

OAuth authorization session progress and cleanup are rebuilt from service-owned state and session Secrets.

AgentRun auth preparation is a session/runtime prepare job. It creates only runtime-scoped fake auth context; Envoy-side processing reads the source Secret when replacing headers.

Auth-bound model catalog discovery is a model-service responsibility and must use Envoy-side header injection.

OAuth refresh only updates credential state; it does not discover or write provider model catalogs.
