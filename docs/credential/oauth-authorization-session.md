# OAuth Authorization Session

这份文档定义 `credential` domain 中 OAuth 授权过程的资源模型。

## 模型图

```text
OAuthAuthorizationSessionSpec
  -> SessionID
  -> Provider
  -> Flow
  -> RedirectURI
  -> TargetCredentialID
  -> TargetDisplayName

OAuthAuthorizationSessionStatus
  -> Phase
  -> AuthorizationURL
  -> UserCode
  -> PollIntervalSeconds
  -> ExpiresAt
  -> ImportedCredential
  -> ObservedGeneration
  -> Conditions
  -> Message
  -> UpdatedAt

OAuthAuthorizationSessionCondition
  -> Type
  -> Status
  -> Reason
  -> Message
  -> ObservedGeneration
  -> LastTransitionTime
```

## 职责

`OAuthAuthorizationSession` 负责表达：

- 一次 OAuth 授权 session 的 desired input
- 一次 OAuth 授权 session 的 observed summary state
- 授权完成后导入 credential 的结果
- session 生命周期与从属敏感资源的清理边界
- browser-facing session UI 依赖的 provider catalog 不由前端硬编码，而由 platform-owned provider catalog 提供

它不负责：

- 承载长期 OAuth credential
- 承载 refresh 调度
- 暴露 provider-specific token material

## OAuthAuthorizationSessionSpec

- `SessionID`
  作用：稳定标识一次 OAuth 授权 session。
- `Provider`
  作用：标识 OAuth provider。
- `Flow`
  作用：标识授权流类型，取值为 `CODE` 或 `DEVICE`。
- `RedirectURI`
  作用：`CODE` flow 的 provider callback 地址。
- `TargetCredentialID`
  作用：授权成功后导入的 credential 稳定标识。
- `TargetDisplayName`
  作用：授权成功后导入的 credential 展示名。

## OAuthAuthorizationSessionStatus

- `Phase`
  作用：表达 session 当前生命周期阶段。
- `AuthorizationURL`
  作用：用户打开的 provider 授权地址。
- `UserCode`
  作用：`DEVICE` flow 的用户输入码。
- `PollIntervalSeconds`
  作用：`DEVICE` flow 下一次建议轮询间隔。
- `ExpiresAt`
  作用：本次 session 到期时间。
- `ImportedCredential`
  作用：授权成功后导入的 credential summary。
- `ObservedGeneration`
  作用：controller 已处理到的 spec generation。
- `Conditions`
  作用：session 的稳定 condition 集合。
- `Message`
  作用：当前可读状态说明。
- `UpdatedAt`
  作用：最近一次 status 写入时间。

`Phase` 取值：

- `PENDING`
- `AWAITING_USER`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `EXPIRED`
- `CANCELED`

## Conditions

- `Accepted`
  作用：session 输入已被平台接受。
- `AuthorizationReady`
  作用：provider 授权入口已准备好。
- `Completed`
  作用：session 已进入 terminal state。

## Secret Boundary

session 关联的敏感 `Secret` 只保存：

- PKCE `code_verifier`
- `state`
- `device_code`
- callback payload
- 临时 token material（`access_token`、`refresh_token`、`id_token`）

规则：

- 敏感材料不进入 `spec` 或 `status`。
- `refresh_token` 可以短暂存在于 session Secret，但导入成功后必须迁入正式 credential backing Secret。
- session terminal 后必须删除 session Secret。

## Execution Boundary

- OAuth session controller 在 `platform-auth-service` 内执行 callback exchange、device poll 与 credential import。
- session 仍然是业务真相。
- 外部执行细节不进入对外 contract。

## Ownership

- `OAuthAuthorizationSession` 拥有本次授权主状态。
- `CredentialDefinition(kind=OAuth)` 拥有导入后的长期凭证和 refresh 生命周期。
- OAuth refresh 由 `oauth-maintenance` Temporal Schedule 执行，不处理 session 主状态。
