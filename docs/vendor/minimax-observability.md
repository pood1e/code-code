# MiniMax Observability

## responsibility

- `minimax` vendor package 持有 MiniMax API key path 的 quota observability。
- vendor active query runner 对 MiniMax Token Plan remains API 发起低频查询，并导出 provider endpoint scoped quota gauges。
- provider observability read path 继续消费 owner-owned visualization intent，不复用 CLI identity；vendor identity 通过 `vendor_id` label 表达。

## external surface

- `packages/platform-k8s/internal/supportservice/vendors/support` service registry
- `vendorCapabilityPackage.observability`
- `observability.profiles[].active_query.collector_id = minimax-remains`
- `GET https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains`
- `GET https://www.minimax.io/v1/api/openplatform/coding_plan/remains`

## implementation notes

- vendor active query runner：
  - 读取 `VendorCapabilityPackage.observability`
  - 解析 API key credential
  - 解析 endpoint `network_policy_ref`
  - 按 `collector_id` 调用 vendor collector
  - 导出 canonical provider metric families
- MiniMax collector host 按 provider endpoint host 归一化：
  - `*.minimaxi.com` -> `https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains`
  - `*.minimax.io` -> `https://www.minimax.io/v1/api/openplatform/coding_plan/remains`
- 当前平台只接 MiniMax text-compatible provider endpoint，因此 v1 quota contract 导出通用 quota metrics：
  - `gen_ai_provider_quota_remaining`
  - `gen_ai_provider_quota_limit`
  - `gen_ai_provider_quota_remaining_fraction_percent`
  - `gen_ai_provider_quota_reset_timestamp_seconds`
- 推荐 label：
  - required: `vendor_id`
  - required: `provider_surface_binding_id`
  - required: `provider_account_id`
  - optional: `model_id`
- 官方 FAQ 当前只公开了 remains endpoint 与 host；collector parser 按当前已观测的 `model_remains[]` shape 设计，并在真实落地时用线上 payload 校验字段。
- MiniMax remains response 优先消费 `model_remains[]` 中的 text model entry；`MiniMax-*` 高速版与标准版按各自 `model_name` 区分。
- provider account card 与 observability detail 继续走 owner-owned visualization：
  - `provider_account_quota_card`
  - `provider_account_observability_detail`
