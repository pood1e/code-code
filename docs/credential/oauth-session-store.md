## OAuth Session Secret Store

### Responsibility

Pending OAuth authorization sessions use namespace-scoped Kubernetes Secrets as
one implementation detail for sensitive material storage.

### Owner

`packages/platform-k8s/internal/authservice/oauth` owns session Secret encoding and decoding.
`OAuthAuthorizationSession` controller owns lifecycle cleanup of session
Secrets.

### Key Types

- `OAuthSessionSecretStore`
  Persists, reads, deletes, and lists managed OAuth session Secrets.
- Flow-specific session records
  Define the fields required by each OAuth flow while reusing the same Secret
  lifecycle and labeling model.

### Internal Composition

- Store entry
  Owns constructor plus shared Secret CRUD and expiry cleanup.
- Flow records
  Own code and device session payload validation and Secret decoding.
- Callback persistence
  Owns callback-state lookup plus callback payload read and write.
- Artifact persistence
  Owns OAuth artifact and execution-result read and write.

The store remains a Secret-backed persistence adapter only. OAuth protocol
state, authorization flow control, and credential import continue to belong to
`packages/platform-k8s/internal/authservice/oauth` services and controllers above this layer.

### Labels

- `credential.code-code.internal/oauth-session`
  Marks managed OAuth session Secrets.
- `credential.code-code.internal/oauth-cli`
  Stores the OAuth CLI identifier.

### Methods

- `PutCodeSession` / `GetCodeSession` / `DeleteCodeSession`
  Manage code-flow session Secrets by `cli_id` and session identifier.
- `PutDeviceSession` / `GetDeviceSession` / `DeleteDeviceSession`
  Manage device-flow session Secrets by `cli_id` and session identifier.
- `FindCodeSessionByState` / `PutCodeCallback` / `GetCodeCallback`
  Resolve one code-flow session from the browser callback and persist callback
  payload.
- `DeleteExpiredSessions`
  Removes expired managed session Secrets for all CLI OAuth sessions.

### Failure Behavior

- Invalid flow-specific session payloads are rejected before persistence.
- Missing session Secrets are reported as not found.
- Cleanup ignores non-session Secrets and deletes only expired managed session
  Secrets.
