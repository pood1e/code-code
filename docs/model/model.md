# Model Contract

## Responsibility

`model` 只负责 canonical model truth：

- stable canonical identity
- canonical metadata
- canonical ref lookup
- provider override merge

它不负责：

- provider availability
- endpoint-local model id
- provider latency、quota、region
- registry page 的 source 投影

## ModelRef

- `vendor_id + model_id`
  - canonical model 的完整稳定标识

规则：

- `ModelRef` 一旦出现，就必须是完整 canonical ref
- provider/catalog 可以消费已绑定好的 `ModelRef`
- provider/catalog 不负责补全、推断、拆解 `ModelRef`

## ModelDefinition

- `model_id`
- `vendor_id`
- `display_name`
- `aliases`
- `context_window_tokens`
- `max_output_tokens`
- `capabilities`
- `primary_shape`
- `supported_shapes`
- `input_modalities`
- `output_modalities`

规则：

- `ModelDefinition` 表达 canonical model metadata
- `vendor_id + model_id` 是唯一业务真值
- `primary_shape` / `supported_shapes` 表达 platform runtime compatibility

## ModelOverride

`ModelOverride` 表达 provider 对 canonical model 的局部覆盖。

允许字段：

- `display_name`
- `context_window_tokens`
- `max_output_tokens`
- `capabilities`
- `primary_shape`
- `supported_shapes`
- `input_modalities`
- `output_modalities`

## ResolvedModel

- `model_id`
  - canonical model id
- `effective_definition`
  - 应用 override 后的有效 canonical 定义

## ModelRegistry

职责：

- `Get(ref)`
  - 按完整 `ModelRef` 读取 canonical `ModelDefinition`
- `List()`
  - 列出当前可见 canonical `ModelDefinition`
- `ResolveRef(modelIDOrAlias)`
  - 按 canonical id 或 alias 返回完整 canonical `ModelRef`
- `Resolve(ref, override)`
  - 合成 `ResolvedModel`

规则：

- registry 对外只暴露 canonical 能力
- vendor-scoped binding 可以存在，但属于 model 域内部实现，不属于共享 consumer contract
