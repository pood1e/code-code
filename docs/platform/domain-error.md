# Domain Error

平台 domain service 使用 typed error types 表达业务语义错误，使得传输层（gRPC / HTTP）可以通过类型断言映射到精确的 status code，无需 fragile string matching。

## Error Types

| Type | 语义 | gRPC Code | HTTP Status |
|---|---|---|---|
| `AlreadyExistsError` | 资源已存在 | `AlreadyExists` | `409 Conflict` |
| `NotFoundError` | 资源不存在 | `NotFound` | `404 Not Found` |
| `ValidationError` | 输入校验失败 | `InvalidArgument` | `400 Bad Request` |
| `ReferenceConflictError` | 资源被引用，不可删除 | `FailedPrecondition` | `409 Conflict` |

## 位置

`go-contract/domainerror/` — 跨 `platform-k8s`、`console-api` 共享。

## Key Types

### AlreadyExistsError

- **职责**：标识一个创建操作因同名资源已存在而失败。
- **字段**：`Message string` — 人可读的错误描述。

### NotFoundError

- **职责**：标识一个读取或删除操作因资源不存在而失败。
- **字段**：`Message string`。

### ValidationError

- **职责**：标识输入数据未通过业务校验。
- **字段**：`Message string`。

### ReferenceConflictError

- **职责**：标识一个删除操作因其他资源仍引用此资源而被拒绝。
- **字段**：`Message string`。

## 构造函数

每种 error type 提供一个 `New<Type>(format, args...)` 构造函数，接受 `fmt.Sprintf` 格式。

## 边界

- domain service 层产生并返回 typed error。
- gRPC handler 层通过 `errors.As` 映射到 gRPC status code。
- HTTP handler 层通过 gRPC status code 映射到 HTTP status code。
- domain service 不直接返回 gRPC 或 HTTP 错误。
