# Vendor Model Collection

## Responsibility

vendor public model collection 是 `ModelDefinitionSync` 的采集输入，不是持久化 truth。

## External Surface

- `platform.model.v1.ModelService.SyncModelDefinitions`
- OpenRouter `GET /api/v1/models`
- `PLATFORM_MODEL_SERVICE_MODEL_SYNC_NETWORK_POLICY_ID`
- `ModelDefinitionSync`

## Implementation Notes

- collection snapshot 只在 sync 过程中驻留内存。
- 采集结果只写入 model-service owned `ModelRegistryEntry` / Postgres registry read model。
- OpenRouter `id` 是 stable model identity 的第一来源；`canonical_slug` 只作为 alias / provenance 补充。
- 显式 `preview` / `latest` / `experimental` channel model 默认不进入 canonical registry。
- 同一 canonical model 出现多个 OpenRouter variants 时，只用低风险规则补空字段，不做 union / max 推断。
