# Console API Error Mapping

本文定义 `console-api` 的 error → HTTP status 映射策略。

## 原则

- gRPC status code 和 K8s API error 类型是 HTTP status 映射的唯一可靠来源。
- 禁止使用 error message string matching 判断 HTTP status。
- 5xx 错误对外统一返回 `"internal server error"`，不泄露内部 error message。
- 4xx 错误透传 gRPC status message 作为 client-facing message。

## gRPC Code → HTTP Status

| gRPC Code | HTTP Status |
|---|---|
| `OK` | fallback status |
| `InvalidArgument` / `OutOfRange` | `400 Bad Request` |
| `Unauthenticated` | `401 Unauthorized` |
| `PermissionDenied` | `403 Forbidden` |
| `NotFound` | `404 Not Found` |
| `AlreadyExists` / `Aborted` / `FailedPrecondition` | `409 Conflict` |
| `ResourceExhausted` | `429 Too Many Requests` |
| `Unavailable` / `DeadlineExceeded` | `503 Service Unavailable` |
| 其他 | `500 Internal Server Error` |

## K8s API Error → HTTP Status（补充路径）

| K8s Error | HTTP Status |
|---|---|
| `IsAlreadyExists` / `IsConflict` | `409 Conflict` |
| `IsNotFound` | `404 Not Found` |
| `IsInvalid` / `IsBadRequest` | `400 Bad Request` |
| `IsForbidden` | `403 Forbidden` |
| `IsUnauthorized` | `401 Unauthorized` |
| `IsTooManyRequests` | `429 Too Many Requests` |

## Response Shape

Error response 统一使用 `ErrorResponse` 结构：

```json
{
  "code": "error_code",
  "message": "human readable message"
}
```

## 规则

- `platform-k8s` domain service 应通过 typed error 或 gRPC status 包装所有错误。
- `console-api` 的 `httpjson.StatusForServiceError` 只检查 gRPC status 和 K8s API error 类型。
- 任何无法映射的 error 统一返回 `500 Internal Server Error`。
