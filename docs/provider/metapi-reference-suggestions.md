# Provider Fallback And Host Latency Telemetry Suggestions

## Purpose

这份文档只记录参考建议，不定义当前主线模型。

当前判断：

- 暂时保留手动 fallback 就足够。
- metapi 的智能路由思路有参考价值，但现阶段偏离 Agent container 主线。
- 短期更值得落地的是 host latency telemetry、连通性诊断、fallback 预览和运行后解释。

目标不是自动替用户路由，而是让用户更容易配置和维护 fallback。

## Scope

短期建议只做：

- host 级延时 telemetry。
- fallback 配置前的候选可用性预览。
- AgentRun 后的实际选择与失败解释。
- access target labels 的展示。

暂不做：

- 自动健康评分选路。
- 自动 cooldown 和恢复。
- 成本/余额/成功率混合加权。
- 多候选随机负载均衡。
- 根据运行时健康自动改写用户 fallback 顺序。

## Industry Baseline

业界对这类能力通常不是从智能路由开始，而是从 black-box / synthetic probe 开始。

可借鉴的共同点：

- 探测外部可见行为，而不是推断 provider 内部状态。
- 每次 probe 有明确 timeout。
- probe 请求应低成本、可重复、无用户内容。
- 记录 `success`、`duration`、状态码或错误原因。
- 区分成功请求 latency 和失败请求 latency。
- 周期性 probe 要有 interval、jitter、失败阈值，避免同一时间打爆目标。
- 探测结果先用于诊断和展示，不直接改变流量。

不建议短期引入：

- 自动 ejection。
- 成功率加权。
- P99 聚合健康分。
- 多维复杂依赖判断。

## Implementation Baseline

不要手写 probe 引擎。

建议明确采用 multi-target exporter 模式。

业界标准做法：

- 用 Prometheus `blackbox_exporter` 执行 HTTP / TCP / DNS / ICMP 等 black-box probe。
- 用 Prometheus multi-target exporter pattern 把业务 target 通过 `__param_target` 传给 blackbox exporter。
- 动态目标用 Prometheus service discovery 提供，例如 `http_sd_config`、`file_sd_config`，或 Prometheus Operator `Probe` CRD。
- 平台代码只负责生成 target 列表、去重、贴低基数 telemetry labels，并通过 PromQL 查询 telemetry。

本仓库已有可复用基础：

- `deploy/charts/infrastructure-core/templates/blackbox.yaml` 已部署 `blackbox-exporter`。
- `deploy/charts/infrastructure-core/files/prometheus/prometheus.yml` 已有 `/probe` scrape job 和 relabel pattern。

当前 `platform-health` 已经是静态 target 的 multi-target exporter 形态：

- Prometheus scrape `/probe`。
- 原始 target 写入 `__param_target`。
- 实际 scrape address 被替换成 `blackbox-exporter:9115`。

provider host latency 应新增独立 job，不要塞进 `healthChecks.additionalTargets`：

- `platform-health`: 平台组件健康检查。
- `provider-host-latency`: provider 聚合 host 的外部连通性和 latency。

所以 provider host latency telemetry 的最小实现应是：

1. provider service 聚合 provider / access target / fallback 中出现的 URL。
2. 规范化为唯一 host target：`scheme + host + port`。
3. 暴露 Prometheus HTTP service discovery endpoint，返回 `<static_config>[]` JSON。
4. Prometheus 定期拉取 host targets，并通过专用 provider-host blackbox exporter 探测。
5. console-api 通过现有 observability path 查询 Prometheus，展示每个 fallback 对应 host 的 telemetry。

添加或更新 provider 后，不需要手动触发 probe。只要 provider 的 API surface 写入 base URL，下一次 Prometheus HTTP SD refresh 就会发现对应 host，并在下一次 scrape 产生 `probe_*` metrics。

不建议平台自己实现：

- probe worker。
- 定时调度。
- DNS/TCP/TLS/HTTP 阶段耗时采集。
- Prometheus 指标存储。
- 历史 latency 聚合。
- provider-service probe result read model。

这些已经是 blackbox exporter + Prometheus 的职责。

## Telemetry Ownership

host latency 是 telemetry，不是 provider domain state。

边界：

- `platform-provider-service` 只暴露 provider-host target discovery。
- `blackbox-exporter` 负责实际探测。
- `Prometheus` 保存 `probe_*` metrics，是 host latency 的观测事实源。
- `console-api` / observability UI 通过 PromQL 读取最近样本。
- provider / access target / fallback 配置只提供 host 来源和展示标签。

不要把 host latency 写入：

- `Provider` status。
- `ProviderSurfaceBinding` status。
- credential readiness。
- provider-service read model。
- AgentRun 的业务真相。

可以在 AgentRun explanation 中保存的是展示快照，例如当时选择的 host、latest latency 和 sample timestamp；它只是解释信息，不作为后续路由输入。

Prometheus scrape config 形态：

```yaml
- job_name: provider-host-latency
  scrape_interval: 30s
  scrape_timeout: 12s
  metrics_path: /probe
  params:
    module:
      - provider_http_reachable
  http_sd_configs:
    - url: http://platform-provider-service.{{ .Values.global.platformNamespace }}.svc.cluster.local:8080/internal/prometheus/provider-host-targets
      refresh_interval: 30s
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: provider-host-blackbox-exporter.{{ .Values.global.platformNamespace }}.svc.cluster.local:9115
```

`provider_http_reachable` 使用专用 `provider-host-blackbox-exporter`，避免 provider host telemetry 抢占平台健康检查 blackbox 的资源。

资源边界：

- provider host blackbox exporter 有独立 Deployment / Service / ConfigMap。
- 默认 requests: `25m CPU / 64Mi memory`。
- 默认 limits: `500m CPU / 256Mi memory`。
- provider-service target discovery 默认最多输出 `200` 个 host，可通过 `PLATFORM_PROVIDER_SERVICE_HOST_TELEMETRY_MAX_TARGETS` 调整。

命名空间和出站边界：

- provider host blackbox exporter 运行在 platform 业务 namespace。
- 这是 provider / fallback 的业务可观测，Prometheus 只负责 scrape 和存储。
- platform namespace 应与其他业务控制面一样纳入 Ambient / waypoint。
- blackbox 探测流量应走统一出站路径；如果 egress policy 未允许该 host，probe 应失败并通过 telemetry 暴露。

## Manual Fallback Remains Primary

用户仍然配置明确的 fallback 顺序。

示例：

1. Official provider A
2. Official provider B
3. Custom endpoint C
4. CPA / relay endpoint D

平台只辅助回答：

- 当前每个 fallback 对应的 host 是否连得通。
- 当前每个 fallback 对应 host 的近似 latency。
- credential 是否 ready。
- egress 是否允许。
- model 是否可用。
- access target 有哪些标签。

## Host Latency Telemetry

host latency telemetry 是短期最可取的能力。

建议把它定义成简单的 black-box probe：

```text
normalized_host -> blackbox exporter -> Prometheus probe_* metrics
```

它只回答三个问题：

- 这个 host 当前能不能连上。
- 当前网络路径是否基本可达。
- 这次探测大概花了多久。

它不回答：

- credential 是否有效。
- model 是否存在。
- provider 是否健康。
- fallback 是否应该自动切换。

### Telemetry Subject

建议按以下最小粒度采集：

- `normalized_host`
- `scheme`
- `port`

原因：

- latency 的主要对象是网络路径和目标 host，不是 provider 业务对象。
- 多个 fallback 可能共享同一个 host，重复探测没有价值。
- `surface_id` 可以作为展示和调用上下文，但不进入 host telemetry key。
- credential、model、provider id 不进入 host telemetry key。

去重规则：

- 同一个 `normalized_host + scheme + port` 只产生一个 probe 任务。
- 多个 surface / provider / access target / fallback 引用同一个 host telemetry series。
- host 归一化应去掉 path、query、fragment，只保留小写 host、scheme 和显式端口。

### Collection Type

建议先只支持一类 probe。

#### Host Connectivity Probe

默认 probe。只验证 DNS、TCP、TLS 和 HTTP 基础链路。

推荐方式：

1. Prometheus scrape provider-host target discovery endpoint。
2. Prometheus 使用 relabeling 把目标写入 `__param_target`。
3. blackbox exporter 对 `https://host[:port]` 执行 unauthenticated HTTP(S) probe。
4. 平台读取 `probe_success`、`probe_duration_seconds`、`probe_http_status_code` 和 HTTP phase duration。
5. 平台按 host 维度展示 latest telemetry sample。

检查：

- DNS / TCP / TLS / HTTP reachable。
- egress policy 是否允许。
- HTTP endpoint 是否有响应。

输出：

- reachable / unreachable。
- HTTP status class。
- error reason code。
- latency。

规则：

- blackbox module 可以使用 `GET /`；如果后续确认目标普遍支持 `HEAD`，再切到 `HEAD /`。
- `401` / `403` 可以表示 host reachable，不当作 host telemetry 失败。
- `404` / `405` 也可以表示 host reachable，不当作 host telemetry 失败。
- `5xx` 表示 HTTP reachable，但远端服务状态异常，可显示为 `reachable_with_server_error`。
- 不调用 model list。
- 不调用 completion。
- 不带 credential。
- 不记录 response body。
- 不使用 ICMP ping；很多云网络、CDN、WAF 会丢弃 ICMP，且它不代表 HTTP API 路径。
- 不使用 provider-specific health endpoint，避免把 host probe 变成 provider adapter。

降级规则：

- 如果 scheme 是 `https`，TLS handshake 成功但 HTTP request 失败，仍可记录 `tls_ok_http_failed`。
- 如果目标不是 HTTP(S)，使用 blackbox exporter 的 TCP module。
- 如果 DNS 失败、TCP connect 失败、TLS 失败，直接返回对应 reason code。

credential、model、completion 相关验证应作为单独的 explicit validation，不归入 host latency telemetry。

### Provider Host Discovery

探测目标来自 provider 聚合后的 host，不来自用户手写列表。

聚合来源：

- provider surface base URL。
- custom API endpoint URL。
- fallback candidates 引用的 access target URL。
- CPA / relay endpoint URL。

归一化规则：

- 解析 URL。
- 丢弃 path、query、fragment。
- host 小写。
- 补全默认端口：`https` 为 `443`，`http` 为 `80`。
- 输出 target URL：`scheme://host[:port]/`。
- 同一个 `scheme + host + port` 只输出一次。

Prometheus target discovery 输出只包含低基数、非敏感标签：

- `host`
- `scheme`
- `port`

provider-service 可以在 provider view 中保留引用关系，用于 UI join：

- `normalized_host`
- `source_count`
- `surface_ids`
- `access_target_labels`

禁止输出：

- API key。
- OAuth token / refresh token。
- cookie。
- authorization header。
- provider raw response。
- credential ref。
- model id。

Prometheus HTTP SD response shape：

```json
[
  {
    "targets": ["https://api.openai.com:443/"],
    "labels": {
      "host": "api.openai.com",
      "scheme": "https",
      "port": "443"
    }
  }
]
```

### Telemetry Metrics And Labels

Prometheus metrics 是 host latency 的唯一观测数据面。

核心 metrics：

- `probe_success`
- `probe_duration_seconds`
- `probe_http_status_code`
- `probe_http_duration_seconds`

建议保留的 labels：

- `job="provider-host-latency"`
- `instance`
- `host`
- `scheme`
- `port`

不要进入 Prometheus labels：

- `surface_ids`
- `provider_id`
- `credential_ref`
- `model_id`
- `access_target_labels`
- raw URL path / query

原因：

- Prometheus labels 需要低基数。
- `surface_ids` 和 `access_target_labels` 是控制面展示关系，应在 console-api 查询后 join。
- credential / model / raw URL path 不属于 host latency telemetry。

### Suggested Defaults

短期默认值可以非常保守：

- Prometheus scrape interval: `30s`
- Prometheus scrape timeout: `12s`
- blackbox module timeout: `10s`
- HTTP SD refresh interval: `30s`
- stale TTL: `5m`
- manual preview: read latest result only
- retry: handled by the next scrape, not by platform code

说明：

- 目标探测 10s 即视为超时，由 blackbox module timeout 控制。
- Prometheus scrape timeout 建议略大于 blackbox timeout，否则 exporter 可能来不及返回 timeout 样本。
- 多个 host 的并发由 Prometheus scrape 调度和 blackbox exporter 处理，平台不维护并发 worker。

如果后续做 warning state，再补：

- jitter: `10%`
- consecutive failures before warning: `2`
- consecutive successes before clearing warning: `1`

这些值只影响 UI 诊断，不影响 fallback 执行顺序。

## Telemetry Result

建议 telemetry result 是 Prometheus sample，不是路由真相。

UI 展示字段来自 PromQL 查询结果：

- `normalized_host`
- `scheme`
- `port`
- `probe_success`
- `probe_duration_seconds`
- `probe_http_status_code`
- `probe_http_duration_seconds{phase=...}`
- `status`: UI derived `ok`, `failed`, `unknown`, `stale`
- `reason_code`: UI derived
- `http_status_class`
- `sample_timestamp`

规则：

- 样本过期后显示 stale。
- `probe_success=0` 不自动禁用 fallback。
- `probe_success=1` 不自动提升 fallback 顺序。
- 用户可以基于 telemetry 手动调整 fallback。
- 不保存连续健康状态机，除非后续真的引入健康路由。
- 同一个 host telemetry sample 可以被多个 fallback candidate 展示复用。
- access target labels 在展示时从引用方带入，不写入 Prometheus sample。

PromQL 示例：

```promql
probe_success{job="provider-host-latency"}
probe_duration_seconds{job="provider-host-latency"}
probe_http_status_code{job="provider-host-latency"}
probe_http_duration_seconds{job="provider-host-latency"}
```

stale 判断可以通过样本时间完成：

```promql
time() - timestamp(probe_success{job="provider-host-latency"})
```

## Reason Codes

建议统一 UI derived reason code，便于展示。

示例：

- `egress_denied`
- `dns_failed`
- `tcp_connect_failed`
- `tls_failed`
- `network_timeout`
- `http_unreachable`
- `unsupported_protocol`
- `unknown_error`

规则：

- reason code 可公开给 UI。
- reason code 从 Prometheus sample、target metadata 和 egress 配置派生。
- raw provider response 不进入 telemetry。
- credential、cookie、OAuth code、refresh token 不进入 message。
- `401` / `403` 不等于 host 不可达，可在 UI 中显示为 reachable with auth-required。

## Fallback Preview

保存 fallback 配置前，提供 preview。

Preview 显示：

- fallback 顺序。
- 每个候选对应 host 的 latest telemetry status。
- host latency。
- reason code。
- credential readiness。
- egress readiness。
- model availability。
- access target labels。

Preview 不做：

- 自动重排 fallback。
- 自动选择最优 provider。
- 自动开启高风险 target。

## Run Explanation

AgentRun 后展示实际使用了哪个 fallback。

建议展示：

- selected fallback index。
- selected provider / credential / access target。
- provider-native model id。
- 如果前序 fallback 失败，显示失败 reason code。
- selected target 对应 host 的 latest telemetry latency。
- access target labels。

规则：

- 不记录 raw credential material。
- 不记录 raw provider response。
- 不把 CPA / relay 伪装成 official provider。

## Access Target Labels

标签是 access target 的附带能力，不是固定枚举。

示例：

- `official`
- `custom`
- `local`
- `self-managed`
- `third-party`
- `relay`
- `derived-credential`
- `high-risk`

用途：

- 在 fallback preview 展示。
- 在 run explanation 展示。
- 作为用户手动选择和排序时的提示。
- 后续如果要做健康路由，可作为策略输入。

## CLIProxyAPI / CPA

`CLIProxyAPI` / `CPA` 可以作为 custom API proxy target 评估。

短期建议：

- 只作为 fallback candidate。
- 通过 CPA 暴露的 API key 调用。
- 不导入 CPA 内部 OAuth token files。
- 不把 CPA 内部 model catalog、pricing、quota 当作官方事实。
- 用 access target labels 表达来源和风险，例如 local、self-managed、third-party、relay、derived-credential。
- preview 和 run explanation 中标明目标是 `CLIProxyAPI` / `CPA`。

## Future Health Routing

未来如果手动 fallback 维护成本明显变高，再考虑健康感知路由。

可逐步演进：

1. 只展示 latency telemetry。
2. 允许用户按 latency 手动重排。
3. 对明显不可用候选给出 UI 警告。
4. 引入 optional cooldown 提示，但不自动改顺序。
5. 最后再评估自动健康排序。

## Non-Goals

这些建议不表示当前必须实现：

- 不要求做智能路由。
- 不要求替代手动 fallback。
- 不要求默认接入非官方中转站。
- 不要求默认支持 CLIProxyAPI / CPA。
- 不要求把 relay catalog 同步为 canonical model truth。
- 不要求自动根据 latency 重排用户配置。

## Decision Points

如果短期落地，需要先定：

- provider-host target discovery endpoint 路径和访问控制。
- provider-host target discovery 是否直接由 `platform-provider-service` 暴露。
- `provider_http_reachable` blackbox module 的 accepted HTTP status codes。
- Prometheus scrape interval、timeout 和 HTTP SD refresh interval。
- telemetry stale 判断。
- console-api 是直接 query Prometheus，还是通过现有 provider observability query path 封装查询。
- fallback preview 在 profile 配置页还是 provider 配置页展示。
- AgentRun explanation 是否保存 telemetry display snapshot。

## References

- Kubernetes probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Envoy active health checking: https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/health_checking
- Envoy health check config fields: https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/core/v3/health_check.proto.html
- Prometheus blackbox exporter pattern: https://prometheus.io/docs/guides/multi-target-exporter/
- Prometheus HTTP service discovery: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#http_sd_config
- Prometheus Operator Probe CRD: https://prometheus-operator.dev/docs/api-reference/api/#monitoring.coreos.com/v1.Probe
- Google SRE monitoring principles: https://sre.google/sre-book/monitoring-distributed-systems/
