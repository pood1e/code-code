# Infrastructure

这个目录提供开发与内部环境可直接使用的基础设施入口。

## Core Stack

部署：

```sh
deploy/release.sh deploy
```

渲染入口：

- `deploy/k8s/charts/infrastructure`
- `deploy/lib/deploy-infra.sh`
- 上游 Helm release: `Temporal`, `Kiali Operator`

包含：

- `PostgreSQL`: `postgres.code-code-infra.svc.cluster.local:5432`
- `NATS JetStream`: `nats.code-code-infra.svc.cluster.local:4222`
- `Alertmanager`: `alertmanager.code-code-observability.svc.cluster.local:9093`
- `Prometheus`: `prometheus.code-code-observability.svc.cluster.local:9090`
- `OTel Collector`: `otel-collector.code-code-observability.svc.cluster.local:4318` (OTLP HTTP), `:4317` (OTLP gRPC)
- `Tempo`: `tempo.code-code-observability.svc.cluster.local:3200`
- `Kiali`: `http://<node-ip>:32031/kiali`

## Grafana UI

本地默认部署 Grafana。若不需要 UI，可关闭：

```sh
DEPLOY_GRAFANA=0 deploy/release.sh deploy
```

包含：

- `Grafana`: `grafana.code-code-observability.svc.cluster.local:3000`
- `Grafana`（NodePort）: `http://<node-ip>:32030/grafana`

Grafana 只作为独立可选 UI 暴露，不由 `console-web` nginx 代理。

`Prometheus` 挂载了 StatefulSet 的 `volumeClaimTemplates`，数据目录为 `/prometheus`，重建 Pod 不应导致时序库重置。若要验证：

```sh
kubectl -n code-code-observability get statefulset,pvc
```

`prometheus` 的 PVC 名通常是 `data-prometheus-0`。

Alertmanager 使用 `alertmanager-receivers` Secret 读取企业微信应用通知凭据。内部环境可复制 `deploy/k8s/infrastructure/alertmanager/secret.example.yaml` 后替换 `wechat-api-secret`，并在 `alertmanager-config` 中替换企业微信 `corp_id`、`agent_id`、`to_party`。

注意：若你执行 `kubectl delete statefulset prometheus`，PVC 会因保留策略默认保持；  
若你执行 `kubectl delete statefulset alertmanager`，Alertmanager PVC 也会保留；若你删除 `Namespace`，PVC 仍会随命名空间销毁，历史数据和 silence 也会一起清空。

## Boundaries

- 默认 Secret 只用于内部开发环境。
- 生产环境应替换 Secret、storage class、resource request/limit 与高可用拓扑。
- `Prometheus` 启用 OTLP receiver，并 scrape Istio 标准 `prometheus.io` pod annotations；platform service metrics 通过 OTLP/gRPC 推给 OTel Collector。
- `OTel Collector` 只接 OTLP metrics/traces，并把 metrics 通过 OTLP HTTP 写入 `Prometheus`。
- `Alertmanager` 直接接收 `Prometheus` alert，不写 platform domain state。
- workload 拓扑主路径使用 `Kiali`；不再把自绘 Grafana topology 作为主路径。
