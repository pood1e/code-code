# Device Authorization Flow

通用 OAuth device authorization flow（RFC 8628）contract。

## DeviceAuthorizationRequest

- 无外部字段。

## DeviceAuthorizationSession

- `SessionID`
  作用：session 稳定标识。
- `AuthorizationURL`
  作用：用户需要访问的 verification URL。
- `UserCode`
  作用：用户需要输入的 device code 显示值。
- `PollIntervalSeconds`
  作用：客户端轮询间隔。
- `ExpiresAt`
  作用：session 过期时间。

## DeviceAuthorizationResult

- `Status`
  作用：轮询结果（pending / authorized / denied / expired）。
- `Artifact`
  作用：授权成功时的 token bundle。
- `PollIntervalSeconds`
  作用：服务器建议的下次轮询间隔（slow_down 场景递增）。

## DeviceAuthorizer

通用 device flow authorizer 接口。

- `StartAuthorizationSession(request) -> session`
  作用：启动一次 device authorization flow。
- `PollAuthorizationSession(sessionID) -> result`
  作用：轮询一次 device authorization flow。

Provider-specific 实现在 `platform-k8s/authservice/oauth` 包中注册。
