# OAuth Sessions

## Responsibility

`internal/oauthsessions` 负责把 browser OAuth session JSON API 适配到 `platform-auth-service` gRPC。

## External Routes

- `POST /api/oauth/sessions`
- `GET /api/oauth/sessions/{sessionId}`
- `DELETE /api/oauth/sessions/{sessionId}`
- `GET /api/oauth/sessions/{sessionId}/events`
- `POST /api/oauth/sessions/{sessionId}/callback`

## Implementation Notes

- HTTP request/response 使用 platform OAuth proto JSON。
- callback 记录成功后按 path `sessionId` 读取最新 session state 返回。
- `/events` 通过短轮询 auth-service 输出 `session` SSE event。
