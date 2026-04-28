# CLI Specialization Package

## Summary

`CLISpecializationPackage` 是平台对一个 CLI integration surface 的静态特化包。

当前主线里，它只定义 CLI-owned specialization：

- 图标与展示元数据
- 官网与可选 GitHub 地址
- 支持的鉴权方式
  - 一种 CLI-owned OAuth
  - 若干 API key protocol compatibility
- 每种 auth method 的 auth materialization contract
- 支持的 runtime resource capability surface
  - `skill`
  - `rule`
  - `mcp`
  - `lsp`
- OAuth path 的 model access contract 与 authenticated model catalog probe
- CLI-owned OAuth authorization observability
- 可选的 `vendor_id` 关联

CLI package 可以声明 OAuth authenticated model catalog probe。
probe 结果会先投影到 `ProviderSurfaceBinding.catalog`，并可继续作为 model registry collector source。

## Responsibility

`CLISpecializationPackage` 负责：

- 声明一个 `cli_id` 的展示信息
- 声明 CLI website 与可选 GitHub metadata
- 声明该 CLI 支持哪些 auth methods
- 声明每种 auth method 走哪条 auth materialization path
- 声明该 CLI 支持哪些 runtime resource kinds
- 声明 OAuth path 的 declarative contract
- 声明 OAuth path 的 model access contract 与 authenticated catalog probe
- 声明 CLI-owned OAuth authorization observability
- 声明该 CLI 可选关联哪个 `vendor_id`

它不负责 auth materialization 的具体文件、env、bootstrap 实现代码。

## Resource Shape

`CLISpecializationPackage` 由各 service 的注册表提供，不再作为 Kubernetes config-only 资源下发。

它至少包含：

- `cli_id`
- `display_name`
- `icon_url`
- `website_url`
- `github_url`
- `vendor_id`
- `runtime_capabilities`
- `oauth`
- `api_key_protocols`

规则：

- `icon_url` 直接引用 CLI 官方公开 logo URL
- `vendor_id` 可为空
- 空 `vendor_id` 表示 generic CLI、multi-vendor CLI 或暂无 vendor 归属
- package 只表达静态 contract，不持有 session 或 credential runtime state
- list/read 主线按 service registry 隔离；单个无效 package 不阻断其他 package 的 materialization 与返回
- package 只声明 “是否支持” 与 “能力 key”，不内嵌具体 materialization 逻辑
- package 对 OAuth / API key 都只声明 auth materialization contract，不声明真实 credential 的暴露方式；真实 credential 主线固定为 Envoy-side processor。
- vendor / API key path 的 passive HTTP telemetry profile 归 vendor package
- CLI-owned OAuth path 的 passive HTTP telemetry profile 可以由 `oauth.observability` 定义

## Runtime Capabilities

`runtime_capabilities` 描述一个 CLI 能否消费这些平台资源：

- `skill`
- `rule`
- `mcp`
- `lsp`

每项至少表达：

- `kind`
- `supported`
- `capability_key`

规则：

- `supported=false` 时，session / profile 不能为该 CLI 配置对应资源引用
- `supported=true` 时，必须提供 `capability_key`
- `capability_key` 是 runtime dispatch key，不是用户可见字段
- 同一个 `cli_id` 的资源支持方式差异，由对应 capability bundle 负责
- package 只回答 “支不支持、走哪条 capability path”，不回答 “如何落到 CLI 具体参数/文件/目录结构”

## CLI Capability Bundle

每个 `cli_id` 需要一个 CLI-specific `CapabilityBundle`。

它负责：

- 把 `Skill` 映射成该 CLI 可消费的 materialization
- 把 `Rule` 映射成该 CLI 可消费的 materialization
- 把 `MCP` 映射成该 CLI 可消费的 materialization
- 把 `LSP` 映射成该 CLI 可消费的 materialization
- 产出具体 sidecar / main container 需要的文件、env、args 或 runtime roots

规则：

- `CapabilityBundle` 是实现层 owner，不进 `CLISpecializationPackage` proto payload
- session pre-run sync 必须先读取 `CLISpecializationPackage.runtime_capabilities`
- 只有声明 `supported=true` 的资源种类，才允许进入对应 `CapabilityBundle`
- session 在 run 前重建 `ResourceConfig` 时，必须走当前 CLI 的 `CapabilityBundle`

## OAuth Specialization

`oauth` 至少包含：

- `display_name`
- `flow`
- `supports_one_click_authorization`
- `supported_purposes`
- `recommended`
- `model_catalog`
- `observability`
- `oauth_client`
- `artifact_projection`
- `account_summary_fields`
- `auth_materialization`
- `code_flow` / `device_flow`

规则：

- 一个 `cli_id` 当前最多定义一种 OAuth specialization
- `supports_one_click_authorization` 表达 browser-facing UX 能力，不让 UI 从 `flow` 反推
- `supports_one_click_authorization=true` 时，`flow` 必须是 `CODE`
- `flow=DEVICE` 时，`supports_one_click_authorization` 必须是 `false`
- `oauth_client` 表达 `client_id`、`scopes`、`pkce`
- `code_flow` / `device_flow` 只能二选一，并且必须与 `flow` 一致
- `artifact_projection` 表达如何把 token response / ID token claims 投影到稳定 account fields
- `account_summary_fields` 表达 provider/account 卡片可展示的 OAuth account 摘要字段
- `auth_materialization` 表达 OAuth path 的 runtime placeholder / projection contract
- `observability` 可以描述 CLI-owned OAuth path 的 passive HTTP telemetry
  profile；实际 header 采集由 Istio Telemetry 和 OTel Collector 执行
- provider connect 与 importer 使用 `artifact_projection`
  - 把 OAuth artifact 投影到稳定 account fields

## OAuth Flow Contract

CLI package 的 OAuth contract 需要把当前 authorizer 的稳定差异 declarative 化。

目标：

- generic runtime 只保留 code-flow runner 与 device-flow runner
- CLI-specific 差异尽量收敛到 package contract
- 只有非标准 transport / payload 行为才保留在 CLI-specific method bundle

当前实现状态：

- `Codex` 已基本符合 declarative code-flow contract
- `Gemini CLI` 仍需要 CLI-specific method bundle 持有 confidential client 行为与 userinfo fetch
- `Qwen CLI` 当前 preset 只声明 OpenAI-compatible API key runtime

因此现阶段不是“所有 code flow 都已经纯 declarative”，而是：

- package 负责稳定 contract、projection、model access
- method bundle 负责当前 contract 还没表达出来的 provider-specific OAuth transport

### Common Contract

`oauth_client` 至少包含：

- `client_id`
- `scopes`
- `pkce.required`
- `pkce.challenge_method`

### Code Flow

`code_flow` 至少包含：

- `authorization_url`
- `token_url`
- `authorization_parameters`
- `requires_redirect_uri`
- `requires_state`

### Device Flow

`device_flow` 至少包含：

- `device_authorization_url`
- `token_url`
- `device_authorization_parameters`
- `use_verification_uri_complete`
- `default_poll_interval_seconds`
- `supports_slow_down`

### Artifact Projection

`artifact_projection` 至少包含：

- `field_mappings[].target`
- `field_mappings[].source`
- `field_mappings[].json_pointer`
- `field_mappings[].fallback_to_subject`

规则：

- `json_pointer` 使用 RFC 6901
- 该投影结果只用于 account metadata

### Account Summary Fields

`account_summary_fields` 至少包含：

- `field_id`
- `label`
- `source`
- `value_format`

规则：

- card/read model 只消费 display-ready summary value，不读取原始 OAuth artifact
- `source` 可以取稳定 artifact 字段，或直接从 token response / ID token claims 做 JSON Pointer 提取
- `value_format` 负责 CLI-owned 脱敏方式，例如 `MASK_EMAIL`

## CLI Model Access Catalog

`oauth.model_catalog` 表达 CLI OAuth path 可访问/可消费的默认模型集合。

它至少包含：

- `default_catalog`

语义：

- 这是 CLI access contract
- 平台只持有一个默认 CLI catalog
- 动态探测属于 `modelcatalogsources/clis` 的实现细节
- 如果实际调用时无权限，交给上游 provider/CLI 在调用时返回错误

规则：

- registry page 不读取 `oauth.model_catalog`
- provider connect / importer / refresh sync 通过 `cli_id` 解析 CLI catalog source
- CLI catalog source 失败时可回退到 `default_catalog`
- provider endpoint 上由 CLI source 写出的 catalog，可以继续进入 `ModelDefinition.sources[]`

## API Key Protocols

`api_key_protocols` 表达该 CLI 可直接消费的 API key 协议列表。

每项至少包含：

- `protocol`
- `display_name`
- `auth_materialization`

规则：

- 同一个 package 内 `protocol` 必须唯一
- 这里只声明 CLI 支持该协议
- `auth_materialization` 表达该协议在当前 CLI 下的 placeholder / projection contract
- `request_auth_injection.header_value_prefix` 表达 auth scheme；Envoy auth processor 必须按单个空格规范化 `<scheme> <token>`。
- `auth_materialization.runtime_url_projection_kind` 决定 execution runtime 使用 provider endpoint `base_url` 还是 OAuth artifact `resource_url`
- vendor-specific `base_url`、derived endpoint、registry source 不在这里定义

## OAuth Method Bundle

CLI package 拥有一个 `OAuthMethodBundle` 扩展点。

key：

- `cli_id`

bundle 至少包含：

- `StartAuthorization`
- `RefreshCredential`

按 flow 补充：

- `CODE` flow：必须提供 `CompleteAuthorization`
- `DEVICE` flow：必须提供 `PollAuthorization`

规则：

- method bundle 只负责无法 declarative 化的 CLI-specific OAuth logic
- credential import 仍由 generic credential domain importer 完成
- `vendor_id` 不是 method dispatch key

## Generic Read Path

generic consumer 的读取方式：

- CLI list / logo：读 `CLISpecializationPackage`
- OAuth connect：读 `package.oauth`
- start OAuth session：按 `cli_id` 解析 method bundle
- OAuth session secret / workflow execution：按 `cli_id` 路由，按 `flow` 选择 code/device runner
- import OAuth credential：按 `cli_id` 解析 CLI package，应用 `artifact_projection`，并从 package 读取可选 `vendor_id`
- refresh OAuth credential：按 credential 绑定的 `cli_id` 解析 refresh method
- CLI runtime model access：读 `oauth.model_catalog`
- API key path：先从 `api_key_protocols` 选择协议，再进入 vendor package 或 custom path

主线：

```text
select CLI
  -> resolve CLISpecializationPackage
  -> choose OAuth or API key protocol
  -> start OAuth session
  -> import OAuth credential with artifact projection
  -> load default CLI-consumable model catalog
```

## Failure Behavior

package registry 应 fail fast：

- duplicate `cli_id`
- duplicate `protocol` within one package
- duplicate `header_name` within one auth method without deterministic semantics
- `oauth.flow` 与 method bundle 不匹配
- package 声明了 `oauth` 但缺少 `RefreshCredential`
- `oauth.model_catalog` 非法
- `request_auth_injection` 非法

运行时：

- unknown `cli_id` -> `NotFound` / `InvalidArgument`
- method execution 失败 -> OAuth session terminal failure
- refresh 失败 -> credential refresh failure

## Boundary With Vendor Package

- `VendorCapabilityPackage`
  - 负责 vendor-owned API key specialization
  - 负责 vendor-owned API key registry source
  - 负责 vendor / API key path 的 passive HTTP telemetry profile
- `CLISpecializationPackage`
  - 负责 CLI icon、auth method、CLI-consumable model access、CLI OAuth observability、CLI OAuth authenticated model probe
  - 可选关联 `vendor_id`
  - 不拥有 vendor API key path
  - 通过 OAuth authenticated probe 间接补充 registry source
  - CLI-owned OAuth path 下可以拥有 passive HTTP telemetry profile

两者都是独立 specialization owner。
