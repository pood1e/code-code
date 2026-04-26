# OAuth Authorizer Registry

## 职责

将 CLI-specific OAuth authorization flow 收口到一条按 `cli_id` dispatch 的 registry mainline。平台通过 authorizer registry 根据 `cli_id` 路由到对应的 authorizer 实现。

## 背景

当前 runtime 中有三条 OAuth mainline：

- `Codex` — 标准 Authorization Code Flow
- `Gemini CLI` — Google Authorization Code Flow
- `Antigravity` — Google Authorization Code Flow
- `Qwen CLI` — Device Code Flow

两类 flow 的请求/响应结构不同（Code Flow 需要 redirect_uri + code + state；Device Flow 需要 user_code + poll），无法合并为一种请求。

## 设计

保留按 flow 区分的 runtime interface，但统一通过 `cli_id` dispatch：

### Authorizer Registry

```go
type OAuthAuthorizerRegistry struct {
    codeFlowAuthorizers   map[OAuthCLIID]OAuthAuthorizer
    deviceFlowAuthorizers map[OAuthCLIID]DeviceAuthorizer
}
```

- **Key**：`OAuthCLIID`（如 `"codex"`, `"gemini-cli"`, `"qwen-cli"`）
- **职责**：根据 `cli_id` dispatch 到对应 authorizer
- **注册时机**：`assembleOAuthServices` 创建 authorizer 后注册
- **错误处理**：unknown `cli_id` → `InvalidArgument`

当前注册关系：

- `codex` -> code-flow authorizer
- `gemini-cli` -> code-flow authorizer
- `antigravity` -> code-flow authorizer
- `qwen-cli` -> device-flow authorizer

## Gemini Boundary

`gemini-cli` 当前仍保留 CLI-specific code-flow authorizer，不下沉成 generic package-only runner。

原因：

- Google token exchange 和 refresh 都要求 `client_secret`
- token response 不能稳定直接投影出平台需要的 account metadata
- authorizer 需要在 code exchange 后额外调用 Google `userinfo` endpoint 取回 `account_email` / `account_id`
- OAuth import mainline 依赖 `CLISpecializationPackage`；没有 `gemini-cli` package preset 时，session 即使授权成功也无法完成 import

`antigravity` 与 `gemini-cli` 共享同一条 Google OAuth mainline，只在 client、scope 与后续 Cloud Code enrichment 上有 specialization 差异。

实现约束：

- registry 仍只按 `cli_id` dispatch
- `gemini-cli` 仍走平台统一的 code-session store
- Gemini-specific transport、Google OAuth 参数、userinfo fetch 保留在 `oauth` 包内
- `gemini-cli` package preset 必须与 authorizer 一起落地，保持 import/mainline 闭环

## Current Bundle Boundary

当前 code-flow runtime 仍然允许保留 CLI-specific method bundle。

原因：

- `Codex` 可以主要靠 declarative package contract 表达
- `Gemini CLI` 当前除了标准 code exchange 之外，还需要 confidential client 参数与额外的 account info fetch
- 这类差异还没有下沉进 `CLISpecializationPackage.oauth_client` contract，因此暂时不能完全收敛成纯 package-driven generic code-flow runner

结论：

- registry 继续按 `cli_id` dispatch
- `platform-auth-service` 仍只拥有 dispatch mainline
- 非标准 OAuth transport / payload 行为仍留在 `oauth` 包内的 CLI-specific authorizer

### 扩展点

新增 OAuth CLI 只需：
1. 实现 `OAuthAuthorizer` 或 `DeviceAuthorizer` interface
2. 在 registry 注册

## 边界

- registry 逻辑属于 `platform-auth-service` 层
- authorizer 实现属于 `oauth` 包
- `platform-contract/credential` 定义 shared OAuth interface
