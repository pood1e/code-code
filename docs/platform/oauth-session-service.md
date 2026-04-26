## responsibility

`OAuth session service` 负责 `OAuthAuthorizationSession` 的独立运行面：

- start / get / cancel OAuth authorization session
- record OAuth code callback
- own `OAuthAuthorizationSession` controller
- execute code exchange / device poll / credential import

## external surface

- `platform.oauth.v1.OAuthSessionService`
  - `StartOAuthAuthorizationSession`
  - `GetOAuthAuthorizationSession`
  - `CancelOAuthAuthorizationSession`
- `platform.oauth.v1.OAuthCallbackService`
  - `RecordOAuthCodeCallback`

## implementation

- 与 auth actions 同进程部署在 `platform-auth-service`
- `console-api` 的 OAuth route 固定走 auth upstream
- `SessionManager` 与 `OAuthSessionSecretStore` 在 create / get / cancel / callback update / callback session lookup 这些同步 latest-read 路径上，必须用 `APIReader` 读最新 session resource / secret，避免 controller write conflict 和 cached client read lag 暴露 conflict/not found
- code flow reconcile 必须复用已持久化的 OAuth artifact；同一个 callback code 被 controller 重放时，不允许再次调用 provider token exchange
