# Platform K8s Package Model

这份文档定义 `packages/platform-k8s` 的 package 级抽象边界与 ownership。

## Goal

`platform-k8s` 负责把 platform domain contract 映射到 Kubernetes resources 与 runtime adapters。

## Package Boundaries

### `sessionapi`

- responsibility: expose `platform.management.v1.AgentSessionManagementService` gRPC surfaces for `platform-agent-runtime-service`
- ownership: session runtime transport boundary

### `agentprofiles`

- responsibility: Postgres-backed `AgentProfile` CRUD、selection validation、management view projection
- ownership: agent profile config state

### `providersurfacebindings`

- responsibility: provider endpoint child CRUD、management view projection
- ownership: provider aggregate endpoint children

### `providerdefinitions`

- responsibility: effective provider definition read path from builtin providers and CLI specialization packages
- ownership: provider definition registry projection

### `providerconnect`

- responsibility: vendor API key / CLI OAuth onboarding orchestration
- ownership: provider connect command + connect session finalize

### `authservice/credentials`

- responsibility: credential CRUD、credential material readiness read path、OAuth import、OAuth refresh
- ownership: credential resource + credential-owned auth material truth

### `providerobservability`

- responsibility: provider active observability dispatch and owner capability abstraction
- ownership: provider observability execution boundary

### `models`

- responsibility: canonical model registry、vendor-scoped public collection sync
- ownership: canonical `ModelDefinition` query/read surface、package-managed model definition sync

### `vendors`

- responsibility: vendor identity 与 vendor capability package 的读管理面
- ownership: vendor-facing reference data projection
- structure: `vendors/identity` 负责 vendor definition reader，`vendors/capabilitypackages` 负责 vendor capability package reader

### `clidefinitions`

- responsibility: CLI identity 与 CLI specialization package 的读管理面
- ownership: CLI-facing reference data projection
- structure: `clidefinitions/identity` 负责 CLI definition reader，`clidefinitions/specializations` 负责 CLI specialization package reader，`clidefinitions/oauth` 负责 CLI-owned OAuth contract/projection/sidecar config，`clidefinitions/codeassist` 负责 Google Code Assist HTTP adapter，`clidefinitions/observability` 负责 CLI-owned OAuth runtime metrics

### `providers`

- responsibility: Postgres-backed Provider aggregate CRUD、builtin provider lookup 与 runtime capability surface
- ownership: provider aggregate state

## Ownership Rules

- `agentprofiles` owns `platform_profiles` rows
- `mcpservers` owns `platform_mcp_servers` rows
- `skills` owns `platform_skills` rows
- `rules` owns `platform_rules` rows
- `providers` owns `platform_providers` rows
- `authservice/credentials` owns credential `MaterialReady` current-condition-or-fallback projection
- `providerobservability` owns provider active observability dispatch; vendor API key and CLI OAuth are capabilities
- `models` owns canonical model registry read/write mainline
- `models` owns `VendorCapabilityPackage(scope) -> ModelDefinitionSync -> ModelRegistryEntry` mainline
- `vendors` / `clidefinitions` 只拥有静态 reference data，不拥有 runtime truth
- `clidefinitions/observability` 只投影 CLI OAuth runtime metrics，不写 domain state
- `console-api` 必须通过 domain service gRPC 调用 platform；不得直连 `platform-k8s` package internals
- `internal/*` 只能提供 mechanics，不定义 domain contract
