# Provider Observability

## Summary

`ObservabilityCapability` 是一套可复用的 observability capability schema。

它不是独立 owner package。
真正的 owner 是 host specialization package：

- `VendorCapabilityPackage`
  - 持有 vendor-owned API key observability
- `CLISpecializationPackage.oauth`
  - 持有 CLI-owned OAuth observability

这样边界更干净：

- specialization package 拥有 integration surface
- observability 只描述这个 surface 的指标、采集方式与 availability judgment

## Standard

指标 contract 采用 OpenTelemetry metrics data model 作为语义基线：

- `name`
- `description`
- `unit`
- `kind`
- `attributes`

规则：

- 语义标准以 OTel metric model 为准
- quota / usage / rate-limit 的具体 metric families 当前允许 repo-owned 命名
- shape 必须兼容 OTel data model
- runtime export 统一走 OTLP metrics；PromQL 只作为查询语言 surface

## Responsibility

`ObservabilityCapability` 负责：

- 声明指标类别、单位、类型、attributes
- 声明指标采集方式
- 对 active query 声明最短采集间隔
- 对 passive HTTP telemetry 声明可采集 header 到 metric 的转换
- 声明用于 availability judgment 的指标查询语句
- 声明 model availability judgment 规则

它不负责：

- 提供 owner identity
- 存储原始 vendor / CLI 响应
- 持有 quota / usage / rate-limit 的运行时真相
- 运行 Prometheus 或 OTel collector 基础设施

## Host Packages

### VendorCapabilityPackage

vendor package 中的 `observability` 表达：

- API key management query observability
- API key passive HTTP telemetry observability
- API key path 的 model availability judgment

### CLISpecializationPackage.oauth

CLI OAuth specialization 中的 `observability` 表达：

- OAuth management / refresh query observability
- OAuth runtime passive HTTP telemetry observability
- CLI OAuth path 的 model availability judgment

当前主线约定：

- `codex` active query 对齐官方 `openai/codex` chatgpt base-url 路径，读取 `GET /backend-api/wham/usage`
- quota 主语义是 `primary_window` / `secondary_window`
- `429 usage_limit_reached` 只作为 reset fallback，不替代 window snapshot

规则：

- observability 不脱离 host specialization package 单独存在
- capability 自身没有独立 owner
- owner 由 host package 决定

## Metric Categories

指标类别固定分三类：

1. `QUOTA`
2. `USAGE`
3. `RATE_LIMIT`

规则：

- category 只表达业务语义分组，不替代 metric name
- 同一 capability 可以同时声明多类指标

## Collection Modes

### Active Query

`ACTIVE_QUERY` 表示平台主动查询 management API 或等价 control surface。

它至少声明：

- `minimum_poll_interval`
- optional `collector_id`
- `dynamic_parameters`

规则：

- `minimum_poll_interval` 是平台允许的最短轮询间隔
- collector / controller 不得比它更频繁
- `collector_id` 允许 owner package 显式选择 host-owned collector implementation
- 当 query 依赖 session auth 或其他非 host surface 自带鉴权材料时，使用 `dynamic_parameters`
- `dynamic_parameters` 只声明参数 schema，不持有参数值
- 实际值由 host provider config 以动态 key-value 形式提供
- capability 不写死 `cookie`、`csrf` 等具体字段
- active query 执行方法必须允许显式 `network_policy` 输入
- 显式 `network_policy` 优先于 host surface 自带 `network_policy_ref`
- 两者都为空时，按 platform default policy 解析；若 default policy 不存在则失败

### Passive HTTP Telemetry

`PASSIVE_HTTP` 表示平台从 L7 proxy access-log stream 被动提取业务指标。

它至少声明：

- `capture_point`
- `transforms`
- `redaction.drop_raw_headers=true`

每条 transform 至少包含：

- `source`
- `header_name`
- `metric_name`
- `value_type`

规则：

- header 采集落点必须是真正处理 HTTP 的 waypoint 或 egress gateway。
- ztunnel 是 L4，不承载 header 采集或改写。
- support 只同步 profile；`platform-egress-service` 负责生成 Istio
  `Telemetry`、MeshConfig access-log provider 和 OTel Collector runtime config。
- OTel Collector 用 `signal_to_metrics` 从 access log 转成指标。
- 敏感 header 不能作为 transform；原始 header 日志默认丢弃。

## Capability Shape

`ObservabilityCapability` 至少包含：

- `profiles`

### ObservabilityProfile

每个 profile 至少包含：

- `profile_id`
- `display_name`
- `metrics`
- `collection`
- `metric_queries`
- `availability_judgment`

可选包含：

- `scope_ids`

语义：

- `scope_ids` 是 host package 内的子 surface 绑定
- 在 `VendorCapabilityPackage` 中，通常对应 `provider_surface_binding.surface_id`
- 在 `CLISpecializationPackage.oauth` 中，通常为空
- 若 `collection.active_query.dynamic_parameters` 非空，host provider config 必须提供对应参数值

### ObservabilityMetric

每个 metric 至少包含：

- `name`
- `description`
- `unit`
- `kind`
- `category`
- `attributes`

### Metric Query

每个 `metric_query` 至少包含：

- `query_id`
- `display_name`
- `language`
- `statement`
- `metric_names`
- `result_kind`

语义：

- `metric_queries` 表达对已导出 metrics 的查询语句
- 当前主线默认 `language=PROMQL`
- query statements 用于 availability judgment
- 这些查询语句必须足以按 model / endpoint / account 维度判断可用性

### Availability Judgment

每个 `availability_judgment` 至少包含：

- `subject_kind`
- `subject_label_key`
- `query_ids`
- `rules`

规则：

- 当前主线 `subject_kind=MODEL`
- `subject_label_key` 通常是 `model_id`
- `query_ids` 引用同 profile 下已声明的 `metric_queries`
- `rules` 至少能产出 `AVAILABLE`、`DEGRADED`、`UNAVAILABLE`
- vendor API key 与 CLI OAuth 都可以声明 model availability judgment

## Method Family

observability capability 需要两类 method family：

1. `ObservabilityCollectMethod`
   - key: `host owner + profile_id`
   - responsibility:
     - `ACTIVE_QUERY`：执行主动查询
     - `PASSIVE_HTTP`：声明 profile，实际采集由 Istio Telemetry + OTel
       Collector 执行
   - input:
     - `profile_id`
     - optional `network_policy_ref`

2. `AvailabilityJudgmentMethod`
   - key: `host owner + profile_id`
   - responsibility:
     - 执行 `metric_queries`
     - 依据 `availability_judgment.rules` 生成 model availability result

## Failure Behavior

host package registry 应 fail fast：

- duplicate `profile_id` within one capability
- `ACTIVE_QUERY` 缺少 `minimum_poll_interval`
- `PASSIVE_HTTP` 缺少 `capture_point`、`transforms` 或
  `redaction.drop_raw_headers=true`
- `metric_query.metric_names` 指向未声明 metric
- `availability_judgment.query_ids` 指向未声明 query

运行时：

- unknown profile -> `NotFound` / `InvalidArgument`
- active query 失败 -> 当前采集周期失败，不破坏其他 profile
- header parse 失败 -> OTel Collector 丢弃该样本，不记录原始敏感值
- availability judgment 失败 -> 当前 subject 标记为 unknown / unavailable，并记录错误

## Boundary

- `VendorCapabilityPackage`
  - 拥有 vendor API key specialization
  - 可内嵌 `observability`
- `CLISpecializationPackage`
  - 拥有 CLI specialization
  - 其 `oauth` 可内嵌 `observability`
- `ObservabilityCapability`
  - 只描述能力 shape
  - 不独立拥有 surface
