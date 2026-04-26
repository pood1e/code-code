# Model Source

## Responsibility

- `ModelRegistryEntry` 是 model sync 写入的 model-service registry read model。
- direct model 与 proxy model 使用同一套 `ModelDefinition` 形状。
- `sourceRef` 只表达父子关系：
  - direct model 为空
  - proxy model 指向其归属上游 `vendor_id + model_id`

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
- proxy 候选保留自己的 identity，并写入 `sourceRef`
- authority priority 只用于 sync 内部覆盖，不进入存储 contract
