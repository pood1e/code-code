# CLI Runtime Service

## responsibility

`platform-cli-runtime-service` owns CLI runtime version observation and image build request orchestration.

- sync official CLI versions into Postgres-backed version snapshots
- emit one protobuf domain event when a runnable CLI version changes
- submit one Temporal image build workflow for each runnable CLI version change
- serve CLI runtime version and image references over gRPC
- serve latest available runtime images from the OCI registry

## external fields

- action: `POST /internal/actions/sync-cli-versions`
- gRPC: `platform.cli_runtime.v1.CLIRuntimeService/ListCLIRuntimeRecords`
- gRPC: `platform.cli_runtime.v1.CLIRuntimeService/GetLatestAvailableCLIRuntimeImages`
- domain event payload: `platform.domain_event.v1.CLIRuntimeEvent`
- Temporal workflow: `platform.cliRuntime.imageBuild`
- image registry config: `ConfigMap/cli-runtime-image-build-config`
- pull image registry prefix: `IMAGE_REGISTRY_PREFIX`
- registry API lookup prefix: `IMAGE_REGISTRY_LOOKUP_PREFIX`
- registry API lookup insecure flag: `IMAGE_REGISTRY_LOOKUP_INSECURE`
- registry latest query timeout: `PLATFORM_CLI_RUNTIME_SERVICE_REGISTRY_LIST_TIMEOUT`
- registry latest query concurrency: `PLATFORM_CLI_RUNTIME_SERVICE_REGISTRY_LIST_CONCURRENCY`
- version state: `platform_cli_version_snapshots`

## implementation

- version sources remain owned by registered `CLISpecializationPackage` data
- runnable image metadata remains owned by `CLIDefinition.container_images`
- image build requests are idempotent by `cli_id + cli_version + build_target`
- the service keeps no local queue or watcher; Postgres version snapshots, NATS JetStream, Temporal, Kubernetes Jobs, and the OCI registry own external state
- image metadata is derived from the current version snapshot and pull registry prefix; the OCI registry is the source of truth for image tags and manifests
- list APIs derive image references from `CLIDefinition.container_images` and the pull registry prefix without requiring build source configuration
- available image lookup may use a separate registry API prefix when the service network path differs from the kubelet image pull reference
- available image metadata is read from registry `cli-*` tags with bounded request timeout and concurrency
- Temporal orchestrates the only heavy build containers through a Kubernetes Job activity
- BuildKit uses the source Git repository as a remote context and pushes immutable version-tagged images plus registry-backed cache into the configured OCI registry
- image build Job prunes old `cli-*` tags in the target repository and keeps the latest two available tags
