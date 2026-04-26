# CLI Official Version Sync

## Responsibility

- `CLISpecializationPackage.oauth.client_identity` 声明 CLI 官方版本源与请求身份模板。
- `cli-runtime-version-sync` Temporal Schedule 定时执行 `platform-cli-runtime-service` activity，从官方结构化 API 拉取最新版本并写入 Postgres 版本快照。
- probe / observability runtime 优先读取版本快照生成 `client_version` 与 UA，避免依赖本地 image tag 漂移。

## External Fields

- `oauth.client_identity.official_version_source`
- `oauth.client_identity.model_catalog_user_agent_template`
- `oauth.client_identity.observability_user_agent_template`

## Implementation Notes

- 当前仅支持两类官方源：
  - npm Registry dist-tags
  - Homebrew Cask JSON API
- official version source 拉取走平台统一 outbound HTTP client。
- official version source host 进入共享 egress Gateway route plan。
- maintenance workflow 由 Temporal worker 承载，`platform-cli-runtime-service` 从静态注册表读 `CLISpecializationPackage`，共享版本快照走 Postgres。
- maintenance workflow 固定按小时级 sweep 同步所有已配置 CLI。
- 同版本不会刷新 `updatedAt`，只有版本变化才产生 protobuf build request 事件。
- 共享快照存放在 `platform_cli_version_snapshots`。
- runtime 解析顺序：
  - 已同步的官方版本快照
  - `CLIDefinition.container_images` 推导出的 semver
- 模板当前只展开 `${client_version}`。
