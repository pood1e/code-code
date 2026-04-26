# Model Registry Authoritative Source

## Responsibility

- `Model Registry` 只读展示平台承认的 stored model definitions。
- canonical identity 固定为 `vendor_id + model_id`。
- `ModelDefinitionSync` 是 package-managed model definitions 的唯一 writer。

## External Surface

- `ListModelDefinitions`
- `ModelRegistryEntry`
- `model.v1.ModelRef`

## Implementation Notes

- `ModelRegistryEntry` 直接投影：
  - `definition`
  - `source_ref`
  - `badges`
  - `pricing`
- `sourceRef` 只表示 parent model：
  - direct model 为空
  - proxy model 指向上游 direct model
- collector source、authority priority 只存在于 sync 内部，不进入 registry contract。
