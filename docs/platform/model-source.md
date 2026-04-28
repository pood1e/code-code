# Model Source

## Responsibility

- `ModelRegistryEntry` 是 model sync 写入的 model-service registry read model。
- canonical model row 与衍生 row 使用同一套 `ModelDefinition` 形状。
- `sources[]` 表达 source 侧 callable observation（`source_id + source_model_id`）以及 source-local badges/pricing。
- `sourceRef` 只表达 canonical parent-child 关系：
  - direct canonical model 为空
  - 仅真正的衍生 canonical model 指向其上游 `vendor_id + model_id`

## External Fields

`platform.model.v1.ModelRegistryEntry` 只保留：

- `definition`
- `source_ref`
- `badges`
- `pricing`
- `sources`

`badges` 只承载业务标签，例如 `free`。

## Sync

- collector 先产出候选 `ModelDefinition`
- direct 候选按 canonical identity 合并
- source observations 以 `source_id + source_model_id + is_direct` 去重写入 `sources[]`
- 聚合代理商第三方 callable variants 只写 observation，不生成额外 canonical proxy row
- authority priority 只用于 sync 内部覆盖，不进入存储 contract
