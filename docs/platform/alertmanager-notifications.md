# Alertmanager Notifications

## Responsibility

`Prometheus` owns alert rule evaluation from low-cardinality metrics projection.

`Alertmanager` owns alert grouping, routing, inhibition, silencing, dedupe, and notification delivery.

Notification channel configuration is infrastructure state. It must not become platform domain state, and it must not change `AgentSession`, `AgentRun`, or provider resource status contracts.

## External Fields

Kubernetes surface:

- `alertmanager.code-code-observability.svc.cluster.local:9093`
- `alertmanager-headless.code-code-observability.svc.cluster.local`
- `alertmanager-0.alertmanager-headless.code-code-observability.svc.cluster.local:9093`
- `prom/alertmanager:v0.32.0`
- `/etc/alertmanager/alertmanager.yml`
- `/etc/alertmanager/templates/*.tmpl`
- `/alertmanager` persistent storage for silences and notification log
- `alertmanager-receivers` for receiver credentials

Prometheus surface:

- `alerting.alertmanagers` targets Alertmanager directly.
- `rule_files` loads platform alert rules.
- Alert labels stay low-cardinality: `severity`, `component`, `owner_kind`, `team`.
- Alert annotations carry human context: `summary`, `description`, `runbook_url`, `dashboard_url`.

Receiver surface:

- Enterprise WeChat app delivery uses Alertmanager `wechat_configs`.
- Enterprise WeChat group message push needs a webhook adapter because Alertmanager `webhook_configs` sends Alertmanager webhook JSON and cannot render the custom group robot body directly.
- Other receivers use native Alertmanager integrations first; unsupported channels use `webhook_configs` plus a thin adapter before adding provider-specific logic to platform services.

## Implementation Notes

Render Alertmanager from `deploy/charts/infrastructure-core`, keep `alertmanager-receivers` as an out-of-band Secret, and validate the chart with `helm lint deploy/charts/infrastructure-core` plus `helm template`. The receiver Secret mount is optional so local development can start without notification credentials; production notification delivery still requires the external Secret.

Run a single replica for the MVP. Use a PVC so silences and notification log survive Pod restart. If production HA is needed, run 2-3 replicas, configure Alertmanager peer gossip, and configure Prometheus to send alerts to every Alertmanager pod DNS name rather than through a load balancer.

Kubernetes resources:

- `Service/alertmanager`: ClusterIP service for HTTP API, local UI access, and MVP Prometheus `alerting.alertmanagers`.
- `Service/alertmanager-headless`: `clusterIP: None` service for StatefulSet pod identity and HA peer DNS.
- `StatefulSet/alertmanager`: `serviceName: alertmanager-headless`, `replicas: 1`, `volumeClaimTemplates` for `/alertmanager`.
- `ConfigMap/alertmanager-config`: `alertmanager.yml` and notification templates.
- `Secret/alertmanager-receivers`: receiver credentials; `secret.example.yaml` stays out of the base kustomization.

StatefulSet container:

- args: `--config.file=/etc/alertmanager/alertmanager.yml`, `--storage.path=/alertmanager`, `--web.listen-address=:9093`
- ports: `http:9093`, `cluster:9094`
- probes: `/-/ready` for readiness, `/-/healthy` for liveness
- security: `automountServiceAccountToken: false`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `readOnlyRootFilesystem: true`, `runAsNonRoot: true`, `seccompProfile: RuntimeDefault`
- resources: start near Prometheus scale, then tune from usage

Extend the Prometheus ConfigMap in `deploy/charts/infrastructure-core/templates/prometheus/` with:

- `alerting.alertmanagers`
- `rule_files`
- mounted alert rule files

Prometheus Kubernetes wiring:

- Mount rule files from a separate `prometheus-rules` ConfigMap at `/etc/prometheus-rules`.
- MVP target: `alertmanager.code-code-observability.svc.cluster.local:9093`.
- HA targets: `alertmanager-0.alertmanager-headless.code-code-observability.svc.cluster.local:9093`, `alertmanager-1...`, `alertmanager-2...`.
- Platform-owned metrics enter Prometheus through OTLP; scrape-based self metrics are not part of the MVP path.

Start with a minimal rule pack:

- `ProviderOAuthObservabilityFailureRateHigh`: CLI OAuth observability probe failure ratio over a short window.
- `VendorObservabilityFailureRateHigh`: vendor observability probe failure ratio over a short window.

Default route:

- `critical` routes to the on-call receiver.
- `warning` routes to the platform operations receiver.
- `info` stays quiet unless explicitly routed.
- resolved notifications are enabled only for channels where they reduce operational ambiguity.

Enterprise WeChat application delivery keeps the app secret in `alertmanager-receivers`, renders `markdown` text from templates, and uses Alertmanager grouping and `repeat_interval` to control notification volume.

Enterprise WeChat group message push should be implemented later as a small adapter service that accepts Alertmanager webhook payloads and sends group robot `markdown` messages. The group robot webhook URL must stay in Secret, and the adapter must respect the documented 20 messages per minute per webhook limit.

Config and secret rollout:

- Mount ConfigMap and Secret as directories, not `subPath`, so projected files can refresh.
- After receiver or route changes, run `kubectl -n code-code-observability rollout restart statefulset/alertmanager` or POST `/-/reload` after Kubernetes projects the updated files.
- After Prometheus rule changes, run `kubectl -n code-code-observability rollout restart statefulset/prometheus` or POST Prometheus `/-/reload`.

Network:

- Current `code-code-infra` has no default-deny NetworkPolicy, so MVP notification egress works with cluster default egress.
- If infra egress becomes isolated, allow Prometheus to reach Alertmanager `9093`, Alertmanager pods to reach each other on `9094` TCP/UDP, and Alertmanager to reach Enterprise WeChat HTTPS plus cluster DNS.
- Kubernetes NetworkPolicy cannot express Enterprise WeChat by DNS name; use the platform egress gateway or a CNI-specific FQDN policy if egress is locked down.

Validation:

- `amtool check-config` for `alertmanager.yml`
- `promtool check config` and `promtool check rules` for Prometheus config and rule files
- `helm lint deploy/charts/infrastructure-core`
- synthetic always-firing test alert to verify one Enterprise WeChat receiver before enabling production rules

References:

- https://prometheus.io/docs/alerting/latest/configuration/
- https://prometheus.io/docs/alerting/latest/integrations/
- https://prometheus.io/docs/alerting/latest/high_availability/
- https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
- https://prometheus.io/download/
- https://developer.work.weixin.qq.com/document/path/91770
