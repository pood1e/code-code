# Credential Runtime

这份文档定义 auth-service 内部解析 `credential` 的 behavior contract。

## 模型图

```text
AuthService credential runtime
  -> CredentialRef
  -> CredentialDefinition
  -> ResolvedCredential
```

## Runtime

表示 `platform-auth-service` 内部 credential 查询、解析、刷新和 runtime projection 入口。

方法：

- `Get(ref)`
  作用：按 `CredentialRef` 返回对应 `CredentialDefinition`。
- `Resolve(ref)`
  作用：按 `CredentialRef` 返回当前可用的 `ResolvedCredential`。

## 规则

- 只有 `platform-auth-service` 读取 credential material。
- 其他服务只通过 auth-service gRPC action 触发写入、刷新、probe 与 summary。
- AgentRun runtime prepare 只创建 fake runtime auth context；请求替换由 auth 侧 processor 处理。
- `OAuth` refresh 与 session 生命周期属于 auth-service，不属于 `LLM provider`。
