# OAuth Callback Gateway

这份文档定义 OAuth browser callback 的 HTTP gateway 边界。

## 职责

gateway 负责：

- 接收 provider callback HTTP 请求
- 校验最小 transport 输入
- 将 callback payload 交给 platform 内部 callback service
- 把浏览器重定向回 console completion route

gateway 不负责：

- 直接写 Kubernetes 资源
- 直接执行 token exchange
- 直接导入 credential

## 输入

`CODE` flow callback 固定接收：

- `provider`
- `code`
- `state`
- `redirect_uri`
- `error`
- `error_description`

## 输出

gateway 调内部 `RecordOAuthCodeCallback` 后，重定向到 console completion route，并附带：

- `sessionId`

## 边界规则

- gateway 不暴露 platform-internal gRPC contract 给浏览器。
- gateway 不保存 callback payload。
- gateway 只做 transport translation 和 redirect。
