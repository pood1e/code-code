# OAuth Import

这份文档定义 `credential` domain 中的 `OAuth Import` 抽象。

## 模型图

```text
OAuthAuthorizationSession
  -> Provider
  -> AuthorizationURL
  -> SessionID
  -> ExpiresAt

OAuthArtifact
  -> Provider
  -> AccessToken
  -> RefreshToken
  -> IDToken
  -> TokenType
  -> AccountID
  -> AccountEmail
  -> Scopes
  -> ExpiresAt

OAuthImportRequest
  -> CredentialID
  -> DisplayName
  -> Artifact

OAuthAuthorizer
  -> StartAuthorizationSession(request)
  -> CompleteAuthorizationSession(exchange)

OAuthCredentialImporter
  -> ImportOAuthCredential(request)
```

## 职责

`OAuth Import` 负责表达：

- 如何启动一个 provider-specific OAuth authorization session
- 如何把 provider 返回的 authorization result 收敛成 platform-owned `OAuthArtifact`
- 如何把 `OAuthArtifact` 导入为 platform-owned credential
- 如何通过 platform-owned Envoy egress 出网

它不负责：

- provider connect orchestration
- model discovery
- runtime model routing
- provider runtime 中的请求执行

## OAuthAuthorizationSession

- `Provider`
  作用：标识这次授权会话对应的 OAuth provider。
- `AuthorizationURL`
  作用：提供给外部授权入口打开的授权地址。
- `SessionID`
  作用：标识一次待完成的授权会话。
- `ExpiresAt`
  作用：表达这次授权会话的有效期。

规则：

- `OAuthAuthorizationSession` 只表达待完成的授权状态。
- `SessionID` 由 `credential` domain owner 生成和验证。
- provider-specific PKCE、state、device-code 等细节属于 `OAuthAuthorizer` implementation。

## OAuthArtifact

- `Provider`
  作用：标识 token bundle 的来源 provider。
- `AccessToken`
  作用：当前可用 access token。
- `RefreshToken`
  作用：后续刷新 access token 所需 refresh token。
- `IDToken`
  作用：provider 返回的 identity token。
- `TokenType`
  作用：access token 类型，例如 `Bearer`。
- `AccountID`
  作用：provider 侧稳定账号标识。
- `AccountEmail`
  作用：provider 侧账号邮箱或展示身份。
- `Scopes`
  作用：当前 artifact 已授予 scope 集合。
- `ExpiresAt`
  作用：当前 access token 过期时间。

规则：

- `OAuthArtifact` 表示 provider-owned authorization result。
- `OAuthArtifact` 不是 provider runtime contract。
- `RefreshToken`、`IDToken` 和 provider-specific session metadata 只属于 `credential` domain storage。

## OAuthImportRequest

- `CredentialID`
  作用：导入后 credential 的稳定标识。
- `DisplayName`
  作用：导入后 credential 的展示名称。
- `Artifact`
  作用：待导入的 OAuth artifact。

规则：

- 导入结果必须落成 `CredentialDefinition.Kind=OAuth`。
- 导入后的 storage 必须保留 refresh-capable material，但 `ResolvedCredential` 只暴露 runtime 所需最小字段。

## OAuthAuthorizationRequest

- `Provider`
  作用：标识这次授权请求对应的 OAuth provider。
- `RedirectURI`
  作用：标识 provider callback 返回时必须匹配的 redirect uri。

规则：

- 同一条 authorization session 后续的 exchange 必须复用 platform Envoy egress 主路径。

## OAuthAuthorizer

方法：

- `StartAuthorizationSession(request)`
  作用：启动一次 provider-specific OAuth authorization session。
- `CompleteAuthorizationSession(exchange)`
  作用：把 callback/device-code result 收敛为 `OAuthArtifact`。

规则：

- `OAuthAuthorizer` 负责 provider-specific 授权协议。
- `OAuthAuthorizer` 不直接写 provider runtime。
- `OAuthAuthorizer` 完成后只产出 `OAuthArtifact`。
- `OAuthAuthorizer` 的出网必须复用 platform-owned Envoy egress，不引入独立代理配置面。

## OAuthCredentialImporter

方法：

- `ImportOAuthCredential(request)`
  作用：把 `OAuthArtifact` 导入为 platform-owned OAuth credential。

规则：

- importer 负责把 `OAuthArtifact` 写入 platform-owned credential storage。
- importer 返回的 `CredentialDefinition` 必须可被 auth-service credential runtime 查询。
- `ResolvedCredential` 继续只暴露 provider runtime 必需的 access-token surface。
