# Provider Observability UI

## responsibility

- 在 provider 列表页提供 owner-aware（CLI OAuth + vendor API key）观测摘要面板
- 在 provider 列表卡片提供 owner-owned 原生 summary
- 指标查询按 owner package 做能力判断（CLI 用 `CLISpecializationPackage.oauth.observability`，vendor 用 `VendorCapabilityPackage.observability`）

## key api

- `GET /api/providers/observability/summary?window=15m`
- `GET /api/providers/observability/accounts/{provider_account_id}?window=1h`
- `POST /api/providers/observability:probe-all`

## implementation notes

- console-api 新增 `providers.ObservabilityService`
  - 读取 `ListProviderAccounts`、`ListCLISpecializationPackages`、`ListVendorCapabilityPackages`
  - 以 owner-aware matcher 构建查询主体：
  - active probe：`owner_id + provider_account_id`
  - runtime：`owner_id + provider_surface_binding_id`
  - 仅对 owner package 声明的 metric 家族发起 Prometheus 查询
  - active probe 基础指标按 owner family 切换：
  - CLI：`gen_ai_provider_cli_oauth_active_discovery_*`
  - vendor：`gen_ai_provider_vendor_api_key_active_discovery_*`
  - 手动全量 probe 以 provider account 为粒度触发 owner-aware active-query（CLI + vendor），单 provider 失败只回写局部结果
  - runtime 指标按 owner package 声明动态展开：`active_query + gauge + quota/rate_limit`
  - 抽屉时序图使用 Prometheus `query_range`（step 按窗口自适应）
- Prometheus 查询通过 `CONSOLE_API_PROMETHEUS_BASE_URL` 配置
- console-web
  - 列表顶部渲染 `ProviderObservabilitySummaryPanel`
  - provider 卡片 summary 走 owner-owned `provider_card`
  - Providers 页提供手动全量额度拉取入口
  - `minimax` owner card 读取 `gen_ai_provider_quota_*{vendor_id="minimax"}` 指标并按 `model_id` 聚合 quota 行
