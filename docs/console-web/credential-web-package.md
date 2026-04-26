# Credential Web Package

## Responsibility

- `console-web-credential` 收敛 credential CRUD dialog、OAuth callback UI 和 provider flow 需要的 credential reference data。
- package 只提供 resource surface，不拥有独立 top-level credential page。

## External Surface

- `CredentialFormDialog`
- `OAuthCallbackPage`
- provider authentication flow resource components
- `createCredential(request)` / `updateCredential(id, request)` / `deleteCredential(id)`
- `startOAuthSession(request)` / `useOAuthSession(sessionId)`
- `useVendorCapabilityPackages()` / `useCLISpecializationPackages()`
- `listManualCredentialVendorOptions(...)` / `listOAuthCLIPackages(...)`

## Implementation Notes

- manual credential form 和 OAuth import 都服务于 provider connect / provider edit flow。
- `provider` 负责把 dialog、callback route 和页面动作组合进 shell。
- package 不拥有 shell layout、section navigation、provider page 或 model page。
