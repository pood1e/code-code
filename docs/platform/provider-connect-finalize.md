# Provider Connect Finalize

## responsibility

- own connect-session terminal materialization for provider onboarding
- translate imported credential + planned endpoint into final provider endpoint write
- enforce finalize idempotency against existing provider endpoint identity

## key methods

- `providerconnect.Service.GetSession(ctx, session_id)`
- `providerconnect.Service.syncSession(ctx, record)`
- `providerconnect.Service.finalizeOAuthConnect(ctx, record, oauth_state)`

## implementation

- finalize creates one provider endpoint only after OAuth session reaches `SUCCEEDED`
- CLI OAuth finalize resolves endpoint catalog from CLI package before create
- if target instance id already exists, finalize accepts it only when existing instance matches planned fields:
- `surface_id`
- `provider_id`
- `provider_display_name`
- `provider_credential_id`
- `vendor_id`
- `provider_surface_binding`
- mismatched existing instance is treated as conflict and the connect session fails
