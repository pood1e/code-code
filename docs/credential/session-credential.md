# Session Credential

## responsibility

- 为 management-plane 浏览器态凭据提供独立 `CredentialKind`
- 持有 `schema_id` 与字符串字段集合，不复用 `api_key`
- 让 runtime / observability collector 以结构化 session material 读取 auth data

## key fields

- `CredentialDefinition.kind = CREDENTIAL_KIND_SESSION`
- `CredentialDefinition.session_metadata.schema_id`
- `ResolvedCredential.session.schema_id`
- `ResolvedCredential.session.values`

## notes

- `session` 只表达 auth material，不承载 endpoint、protocol、model catalog
- Postgres 加密 material store 是 credential material 真相；session 字段按 key 单独写入 material store
- `MaterialReady` 只校验必填字段可解析，不推断 session 是否仍有效
- provider account observability override 可落成 account-owned `session` credential
- provider connect 与主认证更新不再复用 `api_key` 携带 observability material
