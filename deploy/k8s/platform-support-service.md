# platform-support-service

## responsibility

Deploys `platform-support-service` as the stateless CLI runtime version and image build request orchestrator.

## external fields

- health HTTP: `platform-support-service:8080/readyz`
- gRPC: `platform-support-service:8081` / `platform.cli_runtime.v1.CLIRuntimeService`
- latest available image API: `GetLatestAvailableCLIRuntimeImages`
- state: `platform_cli_version_snapshots`
- images: configured OCI registry
- registry API lookup: optional separate OCI registry endpoint for listing tags
- registry latest query timeout: `PLATFORM_SUPPORT_SERVICE_REGISTRY_LIST_TIMEOUT`
- registry latest query concurrency: `PLATFORM_SUPPORT_SERVICE_REGISTRY_LIST_CONCURRENCY`
- registry auth: optional `Secret/cli-runtime-image-build-registry-auth`
- event bus: `platform.domain.cli_runtime.image_build_requested`
- Temporal task queue: `platform-support-service`

## implementation

- latest image reads are bounded by registry timeout and concurrency
- returned runtime images use `IMAGE_REGISTRY_PREFIX`; registry tag lookup may use `IMAGE_REGISTRY_LOOKUP_PREFIX`
- version sync and image build orchestration use Temporal
- image build execution is delegated to a Kubernetes Job running BuildKit and regctl
- only one CLI image build Job may run at a time
- `cli-runtime-image-build-config` must point at the source repo and OCI registry before version sync runs
