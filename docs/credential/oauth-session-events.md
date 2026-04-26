# OAuth Session Events

这份文档定义 `OAuthAuthorizationSession` 面向 browser 的事件流边界。

## Summary

`OAuthSessionEvents` 是 console-facing 的只读事件流。

它负责：

- 把 `OAuthAuthorizationSessionState` 的最新快照持续推送给 browser
- 让 browser session page 从主动轮询切换为订阅更新
- 在 session 进入 terminal phase 后结束事件流

它不负责：

- 定义新的 session 状态模型
- 暴露 Workflow runtime 细节
- 替代 `GetOAuthAuthorizationSession` 的一次性读取语义

## Contract

- route: `GET /api/oauth/sessions/{sessionId}/events`
- content type: `text/event-stream`
- event payload: `OAuthAuthorizationSessionState` 的 proto JSON

事件流规则：

- 建连后立即发送一次当前 session 快照
- 只有当 session 快照发生变化时才发送下一次事件
- session 进入 terminal phase 后发送 terminal 快照并结束连接

## Ownership

- `console-api/internal/oauth` 负责把 platform session state 适配成 SSE
- `console-web/credential` 负责订阅该流并刷新 session UI
- `platform-k8s` 继续只拥有 session 真相，不感知 SSE transport

## Failure Behavior

- 读取当前 session 失败时，返回普通 HTTP error
- 建连成功后的短暂 transport 中断由 browser `EventSource` 自动重连
- browser 仍保留一次性 `GetOAuthAuthorizationSession` 作为初始化与重试兜底
