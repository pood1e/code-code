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
  - `sources`
- `sourceRef` 只表示 canonical parent model：
  - direct canonical model 为空
  - 衍生 canonical model 指向上游 direct canonical model
- 聚合代理商第三方 callable variants 只通过 `sources[].source_model_id` 暴露，不新增第三方 canonical proxy row
- collector source、authority priority 只存在于 sync 内部，不进入 registry contract。
