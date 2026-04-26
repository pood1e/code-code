# Credential Contract

## responsibility

`credential` 只负责 auth material：

- credential identity
- auth material kind
- resolved auth material
- auth material readiness
- OAuth refresh lifecycle

它不负责：

- provider endpoint config
- protocol
- base URL
- model catalog

## definition

`CredentialDefinition`：

- `credential_id`
- `display_name`
- `kind`
- `purpose`
- `vendor_id`
- `oauth_metadata.cli_id` optional

规则：

- API key credential 不再持有 endpoint metadata
- `vendor_id` 只表达归属，不表达调用面
- OAuth path 仍然使用 `cli_id` 作为 dispatch key

## resolved

`ResolvedCredential`：

- `credential_id`
- `kind`
- `api_key.api_key`
- `oauth.*`

规则：

- runtime 从 credential 只读取 auth material
- `protocol` / `base_url` 必须从 `ProviderSurfaceBinding.config` 读取
- API key credential 不再决定调用哪个 endpoint
- `MaterialReady` 只表达当前 auth material 是否可解析
- `OAuthRefreshReady` 只表达 refresh lifecycle 状态，不替代 `MaterialReady`
