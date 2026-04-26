## responsibility

复用 Google OAuth code-flow mainline 给多个 CLI specialization。

## key fields

- `cli_id`
- `authorization_url`
- `token_url`
- `userinfo_url`
- `client_id`
- `client_secret`
- `scopes`
- `pkce_required`

## key methods

- `StartAuthorizationSession`
- `CompleteAuthorizationSession`
- `Refresh`

## notes

- `gemini-cli` 与 `antigravity` 共用 Google OAuth token exchange、userinfo、refresh。
- token exchange 对 transport error、429、5xx 做短重试。
- Cloud Code 补充信息仍由 credential specialization 处理，如 `project_id`、`tier_name`、quota。
