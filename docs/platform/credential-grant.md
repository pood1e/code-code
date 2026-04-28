# Credential Grant

## responsibility

`CredentialGrant` is the platform auth resource for API key, OAuth, and session auth grants. It replaces provider-owned credential semantics in new contracts.

## external fields

- `grant_id`: stable identity.
- `display_name`: operator-facing name.
- `kind`: API key, OAuth, or session.
- `purpose`: data plane or management plane.
- `vendor_id`, `cli_id`: owner hints used for resolution and UI guidance.
- `issuer`, `subject`, `scopes`, `resource_url`: standards-aligned OAuth metadata.
- `expires_at`, `generation`: refresh and rotation state visible to callers.
- `status`: material readiness and reason.

## implementation notes

Credential values stay in auth-service-owned encrypted material storage. Kubernetes Secrets are runtime projections only. Provider service and runtime services use grant ids and generation; any material readback must be explicitly declared by support-owned policy. Refresh creates a new observed generation when material changes.
