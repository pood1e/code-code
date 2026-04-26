## responsibility

- 统一 provider observability 指标语义，抽象为通用 metric families（`request` / `token` / `percent` / `quota`）。
- 统一 owner 维度表达为 labels（`owner_kind` + `owner_id`），保持 metric name vendor-neutral / cli-neutral。
- 通过 `metricRepo` 屏蔽 Prometheus 存储名与 OTel semantic 名的读写转换，前后端只消费 semantic 名。

## key fields and methods

- Canonical metric families:
  - `gen_ai.provider.quota.limit`
  - `gen_ai.provider.quota.usage`
  - `gen_ai.provider.quota.remaining`
  - `gen_ai.provider.quota.remaining.fraction.percent`
  - `gen_ai.provider.quota.usage.fraction.percent`
  - `gen_ai.provider.quota.reset.timestamp.seconds`
  - `gen_ai.provider.runtime.quota.limit`
  - `gen_ai.provider.runtime.quota.remaining`
  - `gen_ai.provider.runtime.requests.total`
  - `gen_ai.provider.runtime.rate_limit.events.total`
  - `gen_ai.provider.runtime.rate_limit.limit`
  - `gen_ai.provider.runtime.rate_limit.remaining`
  - `gen_ai.provider.runtime.last_seen.timestamp.seconds`
  - `gen_ai.provider.runtime.retry_after.seconds`
  - `gen_ai.provider.usage.requests.count`
  - `gen_ai.provider.usage.tokens.count`
  - `gen_ai.provider.usage.cost.usd`
  - `gen_ai.provider.account.tier.code`
- Required labels:
  - `owner_kind` (`vendor` | `cli`)
  - `owner_id`
  - `provider_id`
- Optional labels:
  - `provider_surface_binding_id`
  - `model_id`, `resource`, `window`, `token_type`, `org_id`, `region_id`, `tier`, `quota_type`
  - `token_type` when present only uses `input` / `output`
- `metricRepo`:
  - `StorageName(semanticName string) string`
  - `SemanticName(storageName string) string`
  - `NormalizeLabels(labels map[string]string) map[string]string`
  - `LatestGaugeQuery(metricName string, matcher string) string`

## implementation notes

- 写入侧（platform-k8s）collector 只产出 canonical semantic metric names；Prometheus 实际落库名统一由 `metricRepo.StorageName` 生成。
- 查询侧（console-api）统一按 semantic metric name 构建查询，PromQL 使用 `metricRepo` 转换；返回 payload 永远使用 semantic metric name。
- 前端（console-web）新增通用 `MetricItem` 归一化层：
  - 输入：`metricName + labels + value + unit + category`
  - 输出：可渲染的 `request/token/percent/quota` 行模型
  - vendor card 只保留分组与文案映射，不直接硬编码底层 metric names。
- capability package service registry 统一声明 canonical metric names 与 labels；删除旧 `vendor_*` 命名。
- Grafana dashboard 与变量查询统一改为 canonical storage names（下划线）并以 `owner_kind/owner_id` 过滤。
