# Proto Model Boundary Refactor

## responsibility

本次重构把 proto contract 收敛为四类：

- user input：只表达用户必须提交的写入字段
- domain fact：只表达 canonical/resource truth
- derived state：只表达 controller/runtime 派生值
- user view：只表达 console 读取所需聚合字段

禁止 derived state 反向进入 write request。

## key contracts

### provider

- `llm_protocol.v1.Protocol`
  - shared endpoint protocol enum
  - reused by `credential`、`cli_definition`、`provider`、`management`
- `ProviderSurfaceRuntime`
  - endpoint config truth
  - fields: `surface_id`, `display_name`, `kind`, `protocol`, `base_url`, `cli_id`, `network_policy_ref`
- `ProviderSurfaceBindingCatalog`
  - endpoint-local model catalog truth
  - fields: `models`, `source`, `updated_at`, `refresh_after`
- `ProviderSurfaceBinding`
  - instance-owned callable endpoint
  - fields: `config`, `origin`, `catalog`
- `ProviderSurfaceBindingRef`
  - stable runtime reference
  - field: `surface_id`

### model

- `ModelDefinition`
  - canonical model fact only
- `UserModelDefinitionDraft`
  - user create payload
- `RegistryModelMetadata`
  - registry-only view metadata
  - fields: `labels`, `source_kind`, `source_vendor_id`, `source_surface_id`, `deletable`, `provider_access_kind`

### credential

- `CredentialDefinition`
  - credential identity + non-secret metadata
  - OAuth owner key only lives in `oauth_metadata.cli_id`
- `ApiKeyCredentialInput`
  - API key write input
- `OAuthCredentialInput`
  - OAuth write input
- `CredentialOAuthView`
  - operator-facing OAuth status view
  - fields: `account_email`, `expires_at`

### agent_session

- `AgentSessionRuntimeConfig`
  - future-run binding only
  - field: `provider_runtime_ref`

## implementation notes

- management write request must use input-specific messages, not domain fact messages
- management read response should reuse domain messages when no extra aggregation is needed
- enums/timestamps/durations stay strongly typed in proto
- UI string formatting only happens in console adapters
