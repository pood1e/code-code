# Provider Credential Resource Surface

## Responsibility

- 为 provider connection flow 提供 credential create、update、delete 和 OAuth callback surface。
- 把 manual credential form、OAuth session 状态和 callback UI 收敛在 `console-web-credential` package 内。

## External Surface

- `CredentialFormDialog`
- `useCredentials()`
- `createCredential(request)`
- `updateCredential(id, request)`
- `deleteCredential(id)`
- `startOAuthSession(request)`
- `useOAuthSession(sessionId)`
- `OAuthCallbackPage`

## Implementation Notes

- Credential material 不再通过 `console-api` 暴露通用 CRUD；provider authentication 由 provider flow 间接触发。
- `provider` 负责把 dialog 和 callback route 组合进 provider flows；`console-web-credential` 只拥有 resource surface。
- manual credential form 和 OAuth import 是两条主链；当前没有独立 top-level credential page。
