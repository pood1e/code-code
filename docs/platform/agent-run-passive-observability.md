# AgentRun Passive Observability

## Responsibility

- Support service owns the declarative runtime HTTP telemetry profiles.
- `platform-egress-service` owns conversion from support profiles to
  Istio `Telemetry`, Istio MeshConfig access-log provider, and OTel Collector
  runtime config.
- Istio egress waypoint/gateway emits HTTP access logs through the official
  `envoyOtelAls` provider.
- OTel Collector converts selected access-log header attributes into metrics.

## Key Fields

- support YAML `runtime_http_telemetry_profiles.yaml`
- proto `observability.v1.PassiveHttpTelemetryCollection`
- support startup sync `platform.egress.v1.EgressService/ApplyRuntimeTelemetryProfileSet`
- Istio `Telemetry` targeting generated L7 egress `Gateway/code-code-egress-gw-*` resources
- Istio MeshConfig `extensionProviders[].envoyOtelAls`
- OTel Collector runtime ConfigMap `otel-collector-runtime-config`

## Invariants

- Dynamic header rewrite is owned by Istio external authorization; it does not record header metrics.
- Agent-session does not freeze per-run telemetry extraction rules.
- Header collection is configured at the L7 proxy point, not in ztunnel.
- Raw header logs are disabled by default. The debug path is controlled by
  `PLATFORM_EGRESS_SERVICE_ENABLE_LLM_HEADER_LOGS`, exposed in Helm as
  `components.egress.llmHeaderLogs.enabled`.
- Sensitive headers must not be declared as telemetry transforms.

## Implementation Notes

- Support sync is non-blocking: startup launches a retrying background sync and
  does not wait for runtime telemetry config to apply before serving.
- Passive telemetry profiles declare selected request/response headers and the
  metric names/labels they produce.
- The egress service updates MeshConfig so the access-log provider emits
  only selected header attributes.
- The egress service discovers generated L7 egress gateways by egressservice
  management labels and removes the Telemetry resource when there is no active
  L7 gateway target.
- The collector is the normalization point for provider-specific header shapes:
  it converts selected access-log attributes into stable low-cardinality metric
  names and labels before export.
- Enabling debug header logs adds a Loki OTLP HTTP exporter for the same selected
  access-log stream; it is intended for short-lived debugging only.
