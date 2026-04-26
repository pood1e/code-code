# Platform Infrastructure

这份文档定义 platform 可直接使用的基础设施边界。

## 组件

当前基础设施包提供：

- `PostgreSQL`
  作用：承载 platform 长期状态 adapter，例如 `Turn`、`TurnOutput` 与后续非 K8s summary state。
- `NATS JetStream`
  作用：承载 retained timeline event stream、SSE fanout 与异步 projection trigger。
- `Prometheus`
  作用：承载低基数 OTLP metrics storage 与 PromQL query backend。
- `OTel Collector`
  作用：接收 platform OTLP metrics/traces；Go services 主线通过 OTLP gRPC 上报到 `:4317`，collector 再将 metrics 通过 OTLP HTTP 写入 Prometheus，并将 traces 写入 Tempo。
- `Alertmanager`
  作用：承载 Prometheus alert routing、silence、dedupe 与通知分发。
- `Grafana`
  作用：承载 Prometheus dashboard 与运营观测入口。

## 边界

基础设施不改变 control-plane contract。

规则：

- Kubernetes resource 与 status 仍是 `AgentSession`、`AgentRun`、`AgentSessionAction` 的 control-plane summary truth。
- Postgres 只作为 adapter，不暴露 transaction、table、SQL schema 到 domain-facing API。
- NATS 只作为 event transport，不作为 `Turn`、`AgentSessionAction`、`AgentRun` 是否应该执行的唯一真相。
- Prometheus 只保存低基数 OTLP metrics projection，不保存带 `session_id`、`turn_id`、`message_id` 的高基数细节。
- OTel Collector 不做 Prometheus scrape fan-in；Prometheus 只 scrape Istio 标准注解目标，不 scrape platform service `/metrics`。
- Alertmanager 只处理 alert lifecycle 和 notification routing，不写 domain state。
- Grafana 只读取 observability projection，不写 domain state。
- SSE 可以由 NATS event stream 驱动，但 SSE payload 仍是 timeline projection。

## Kubernetes Target

基础设施部署在 `code-code-infra` namespace。

默认服务名：

- Postgres: `postgres.code-code-infra.svc.cluster.local:5432`
- NATS: `nats.code-code-infra.svc.cluster.local:4222`
- Prometheus: `prometheus.code-code-observability.svc.cluster.local:9090`
- OTel Collector: `otel-collector.code-code-observability.svc.cluster.local:4318` / `:4317`
- Alertmanager: `alertmanager.code-code-observability.svc.cluster.local:9093`
- Grafana: `grafana.code-code-observability.svc.cluster.local:3000`

Prometheus 使用 StatefulSet 的 PVC 持久卷挂载 `/prometheus`，Alertmanager 使用 StatefulSet 的 PVC 持久卷挂载 `/alertmanager`。如果只重启 Pod，时序数据、silence 和 notification log 可保留；若执行了命名空间级销毁，则需要外部持久化策略才能保留历史。

## Runtime Provisioning

- timeline `NATS JetStream` stream 由 platform runtime 在首次发布时自动创建。
- Prometheus OTLP receiver、Istio scrape job、alert rule 和 Alertmanager target 由基础设施配置静态声明。

## 版本

当前镜像版本：

- `postgres:18.3`
- `nats:2.12.6-alpine`
- `prom/prometheus:v3.11.2`
- `prom/alertmanager:v0.32.0`
- `grafana/grafana:13.0.0`

参考：

- PostgreSQL Docker official image: https://hub.docker.com/_/postgres
- NATS Docker docs: https://docs.nats.io/running-a-nats-service/nats_docker
- Prometheus download: https://prometheus.io/download/
- Alertmanager download: https://prometheus.io/download/
- Grafana download: https://grafana.com/grafana/download?edition=oss
