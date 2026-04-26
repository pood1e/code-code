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

Secret values stay in Kubernetes Secret material owned by auth service. Provider service and runtime services use grant ids and generation only. Refresh creates a new observed generation when material changes.
