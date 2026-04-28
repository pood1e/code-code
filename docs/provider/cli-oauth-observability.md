# CLI OAuth Observability

这份文档定义 `CLISpecializationPackage.oauth.observability` 的主线设计。

## Responsibility

`cli oauth observability` 负责：

- 为每个 `cli oauth` surface 声明 OTel-compatible metric contract
- 明确 L7 access-log 流里可被动采集的 HTTP header 到 metric 映射
- 明确 management-plane 可导出的 session / refresh / sync 指标
- 为 OTLP metrics 保持稳定 metric name、unit、attribute shape

当前 backend 主线：

- OTel Collector 接收 OTLP metrics
- runtime 与 management 指标统一走 OTLP
- 查询层可以把 OTLP 指标投影到 PromQL-compatible query surface

它不负责：

- 持有 credential 或 provider endpoint 的业务真相
- 存储原始 response payload 或完整 headers
- 定义 dashboard JSON

## Ownership

- owner: `CLISpecializationPackage.oauth`
- runtime truth owner: `ProviderSurfaceBinding`
- credential truth owner: `CredentialDefinition`
- session truth owner: OAuth authorization session state

规则：

- runtime-facing 指标统一以 `provider_surface_binding_id` 作为主体 identity
- 不再把 runtime 指标绑定到 `credential_id`
- session 指标是授权流程级别，不强行附加 `provider_surface_binding_id`

## Interface

每个 CLI OAuth package 维护两类 profile：

1. `oauth_management_state`
   - collection: `active_query`
   - metric family:
     - `gen_ai_provider_cli_oauth_session_*`
     - `gen_ai_provider_cli_oauth_credential_*`
     - `gen_ai_provider_cli_oauth_refresh_*`

2. `oauth_runtime_http_telemetry`
   - collection: `passive_http`
   - metric family:
     - `gen_ai_provider_runtime_requests_total`
     - `gen_ai_provider_runtime_rate_limit_events_total`
     - `gen_ai_provider_runtime_last_seen_timestamp_seconds`
     - header-derived gauges such as `gen_ai_provider_runtime_retry_after_seconds`

runtime attribute contract:

- required: `cli_id`
- required: `provider_surface_binding_id`
- recommended: `host`
- recommended: `model_id`
- optional per metric: `status_class`, `limit_kind`

management attribute contract:

- session metrics: `cli_id`, `flow`, `terminal_phase`
- provider endpoint state metrics: `cli_id`, `provider_surface_binding_id`

Runtime HTTP telemetry contract:

- Profiles are declared in support-owned capability data.
- Support syncs profiles to `platform-egress-service` after startup.
- Istio egress waypoint/gateway emits selected header attributes through
  `envoyOtelAls`.
- OTel Collector converts selected header attributes to numeric metrics.
- `request-id` / `x-request-id` can be captured by the access-log provider for
  log correlation when explicitly declared.

## Active Probe Runtime

- deploy shape: auth-service registers a Temporal Schedule for due scans
- scheduler:
  - Temporal Schedule scans due provider endpoints
  - 不在 manager 启动时立即全量 probe
  - 周期来源：`oauth.observability.profiles[].active_query.minimum_poll_interval`
  - 退避策略：成功走 profile interval，失败与鉴权阻塞走 `5m` backoff
- auth gate:
  - probe 前先执行 `EnsureFresh(min_ttl=30s)`
  - `OAuthRefreshReady!=True` 或 collector 返回 `401/403` 时直接标记 `auth_blocked`
  - `auth_blocked` 不继续对上游发请求
- manual trigger:
- management RPC: `ProbeProviderSurfaceBindingOAuthObservability`
  - console API: `POST /api/providers/endpoints/{surface_id}:probe-observability`
- internal RPC: `platform.provider.v1.ProviderService.ProbeProviderObservability`
  - provider 详情页 `Authentication` 区域提供 icon probe button
  - Providers 页提供手动全量 refresh 入口
  - 手动触发同样受最小间隔节流，不绕过 backoff

## Failure Behavior

- invalid metric name, unit, attribute, query reference:
  - package materialization fail fast
- conflicting passive HTTP telemetry mappings:
  - package materialization fail fast
- OTel Collector header parse failure:
  - 丢弃该 header sample；debug header log 只有在显式开关打开时才导出
- provider endpoint 未绑定：
  - 不导出 instance-scoped refresh counter series
- collector list/get secret 失败：
  - 当前 scrape 跳过对应 sample，不阻塞其他 metrics
- manual `probe-all` 单 provider probe 失败：
  - 只回写该 provider 的 failed result，不阻塞其他 provider

## Extension Points

- 可以为单个 CLI 增加更多 `passive_http.transforms`
- 可以在后续引入 availability judgment，而不改现有 metric families
- 可以在真实 runtime workload owner 出现后，把同一 annotation contract 接入 Pod template materializer
