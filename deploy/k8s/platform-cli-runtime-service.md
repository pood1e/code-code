# platform-cli-runtime-service

## responsibility

Deploys `platform-cli-runtime-service` as the stateless CLI runtime version and image build request orchestrator.

## external fields

- HTTP trigger: `platform-cli-runtime-service:8080/internal/actions/sync-cli-versions`
- gRPC: `platform-cli-runtime-service:8081` / `platform.cli_runtime.v1.CLIRuntimeService`
- latest available image API: `GetLatestAvailableCLIRuntimeImages`
- state: `platform_cli_version_snapshots`
- images: configured OCI registry
- registry API lookup: optional separate OCI registry endpoint for listing tags
- registry latest query timeout: `PLATFORM_CLI_RUNTIME_SERVICE_REGISTRY_LIST_TIMEOUT`
- registry latest query concurrency: `PLATFORM_CLI_RUNTIME_SERVICE_REGISTRY_LIST_CONCURRENCY`
- registry auth: optional `Secret/cli-runtime-image-build-registry-auth`
- event bus: `platform.domain.cli_runtime.image_build_requested`
- Temporal workflow: `platform.cliRuntime.imageBuild`

## implementation

- the service does not watch Kubernetes resources
- latest image reads are bounded by registry timeout and concurrency
- returned runtime images use `IMAGE_REGISTRY_PREFIX`; registry tag lookup may use `IMAGE_REGISTRY_LOOKUP_PREFIX`
- image build execution is delegated to a Temporal activity that creates a Kubernetes Job running BuildKit
- only one CLI image build Job may run at a time
- `cli-runtime-image-build-config` must point at the source repo and OCI registry before unsuspending version sync
