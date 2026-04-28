# Credential Resource

## responsibility

- own credential write mainline across `CredentialDefinitionResource` and encrypted material store
- own credential material normalize, validation, and missing-material preservation on update
- own management-facing credential view projection
- live under `platform-auth-service`; other services use auth gRPC instead of reading material

## key fields

- `definition`
- `material`

## key methods

- `credentials.NewCredential(definition, material)`
- `(*Credential).WithID(credentialID)`
- `(*Credential).Resource(namespace)`
- `(*Credential).MaterialValues()`
- `(*Credential).PreserveMissingMaterialValues(values)`

## implementation

- auth-service transport maps credential write requests to internal credential models
- CRD is the source of truth for credential definition and metadata
- Postgres encrypted material store is the source of truth for API key / OAuth / session auth material
- update path preserves missing auth material from the current material store before write
