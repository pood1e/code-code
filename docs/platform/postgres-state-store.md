# Postgres State Store

这份文档定义 Postgres 作为 platform state adapter 的边界。

## 边界

Postgres adapter 负责承载不适合放入 Kubernetes 的 platform domain state。

Kubernetes 仍负责 runtime workload、Secret、ConfigMap 与三方 controller 资源。

## 数据范围

Postgres 保存：

- `Chat`
  作用：chat metadata、`session_id` 绑定。
- `AgentSession`
  作用：session desired / observed summary state。
- `AgentSessionAction`
  作用：turn durable queue state。
- provider/profile/credential/oauth/model/catalog/profile resource JSON state table
  作用：承接产品/domain data 从 Kubernetes resource 向 Postgres 迁移后的主存储。

Postgres 不保存：

- delta 型 token stream
- timeline history / replay event stream
- Temporal workflow / Kubernetes Job / pod runtime state
- Prometheus metrics projection

## Adapter 规则

- public contract 只暴露 domain state contract。
- Postgres transaction 只属于 adapter 内部实现细节。
- schema mapping 由 Postgres adapter implementation 自己维护。
- domain-facing API 使用 domain model 命名。
- migration 不做兼容保留；内部开发版本允许破坏性重构。
- `AgentSession` 与 `AgentSessionAction` 的产品/control-plane truth 由 explicit Postgres-backed owner APIs 承载。
- `AgentRun` 是 Kubernetes-owned runtime CRD；Postgres 不保存 `platform_agent_runs`。
- `ModelDefinition` 由 model-service 的 `models.PostgresRegistryStore`
  显式写入 `platform_model_registry_entries`，作为管理查询 read model。
- vendor identity/support package 是 support/provider 侧的静态 reference registry，
  不落 Postgres state table，也不通过 Kubernetes CRD 暴露。
- `AgentRun.status.resultSummary` 只保留 retry/failure 判定所需摘要；完整 live output 通过 retained run event stream 消费。

## 外部方法

- `state.OpenPostgres(databaseURL, applicationName)`
  作用：打开 platform Postgres pool 并执行 schema migrations。
- `postgres.Connect(databaseURL, applicationName)`
  作用：创建 bounded `pgxpool.Pool`。
- `postgres.Migrate(migrations)`
  作用：使用 advisory lock 执行 idempotent schema migrations。
- `postgres.NewJSONRepository(table)`
  作用：为已迁移的 JSONB state table 创建 repository。

## 查询

- Postgres-backed list 必须把 namespace、label selector、`metadata.name` field selector 下推到 Postgres。
- 不支持的 selector 直接返回错误，不能退回全表 JSON 反序列化过滤。
- 列表分页使用 keyset token，不使用 offset token。

## 表

- `platform_sessions`
- `platform_chats`
- `platform_agent_session_actions`
- `platform_providers`
- `platform_profiles`
- `platform_credentials`
- `platform_models`
- `platform_catalog_rows`
- `platform_oauth_sessions`
- `platform_model_registry_entries`
- `platform_model_registry_observations`
- `platform_model_registry_source_status`
- `platform_domain_outbox`
- `platform_domain_consumer_events`
- `platform_mcp_servers`
- `platform_skills`
- `platform_rules`

参考：

- PostgreSQL docs: https://www.postgresql.org/docs/
- pgx v5: https://github.com/jackc/pgx
