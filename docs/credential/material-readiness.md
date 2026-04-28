# Credential Material Readiness

## responsibility

- own credential-local `MaterialReady` status projection
- express whether one credential currently exposes usable auth material
- project current material readiness into management-facing `CredentialView.status`

## key methods

- `credentials.MaterialReconciler.Reconcile(ctx, request)`
- `credentials.MaterialReadinessReader.ValidateReady(ctx, ref)`

## implementation

- `MaterialReady` is derived only from credential-owned truth:
- credential definition state
- encrypted material store
- API key credential is ready when material contains non-empty `api_key`
- OAuth credential is ready when material contains non-empty `access_token`
- OAuth `expires_at` is optional; when present it must parse as RFC3339
- refresh lifecycle remains separate:
- `OAuthRefreshReady` expresses refresh job state
- `MaterialReady` expresses current auth material usability
- management `CredentialView.status.material_ready` uses the same current-condition-or-fallback rule
