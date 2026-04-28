# Platform Egress Service

## responsibility

`platform-egress-service` owns the gRPC boundary for platform egress policy and runtime egress telemetry projection. It compiles canonical proto models to Kubernetes and Istio resources.

## external methods

- `platform.egress.v1.EgressService/ListEgressPolicies`
- `platform.egress.v1.EgressService/UpdateEgressPolicy`
- `platform.egress.v1.EgressService/ApplyExternalAccessSet`
- `platform.egress.v1.EgressService/GetEgressRuntimePolicy`
- `platform.egress.v1.EgressService/ApplyRuntimeTelemetryProfileSet`

## implementation notes

- The service Deployment, Service, ServiceAccount, RBAC subject, and policy ConfigMap are deployed in the network egress namespace, `code-code-net` by default.
- `ApplyExternalAccessSet` is the service-owner ingress path. It replaces one access set by `access_set_id`, persists the full policy, and applies the generated resources.
- `ListEgressPolicies` returns the stored canonical policy plus observed generated resources.
- Generated resources live in `PLATFORM_EGRESS_SERVICE_EGRESS_NAMESPACE`.
- Base generation is `ServiceEntry + AuthorizationPolicy targetRefs`; Gateway API routes are a separate L7 policy concern and are not synthesized by baseline external access.
- Runtime telemetry profiles stay as `observability.v1.ObservabilityCapability`, but the service owner is egressservice: it reconciles Istio `Telemetry`, MeshConfig ALS provider, and OTel Collector runtime config for L7 egress gateways.
- The service deletes stale current-model resources by the platform owner labels. Legacy route resources from the removed route model are deleted on the next apply; legacy proxy-era resources are cleaned explicitly during deployment.
