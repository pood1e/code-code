# Model Definition Contract

## Summary

`model.v1.ModelDefinition` 是 platform 内唯一的 canonical model metadata contract。

它用于：

- vendor-provided model 在 canonicalize 之后的标准定义
- runtime canonical metadata resolution

registry page 的读路径使用 `ModelRegistryEntry` 做列表投影，row 只承载列表所需的 canonical row 与 source projection。

## Responsibility

`ModelDefinition` 负责：

- 表达一个 canonical model 的稳定 metadata
- 为 runtime model resolution 提供统一 metadata 基础
- 作为 model registry stored row 的 canonical payload

它不负责：

- provider-callable catalog truth
- provider endpoint observed availability
- CLI OAuth 可消费模型集合
- registry page 的 source/deletability/access 投影

## Common Fields

- `model_id`
  - vendor 内稳定 canonical identity
- `vendor_id`
  - canonical vendor / publisher
- `display_name`
  - 人类可读名称
- `aliases`
  - stable alias、snapshot alias、vendor-specific alias
- `context_window_tokens`
- `max_output_tokens`
- `input_modalities`
- `output_modalities`
- `capabilities`

## Platform-Owned Fields

- `primary_shape`
- `supported_shapes`

这两个字段表达 platform runtime compatibility，不属于 vendor source catalog 通用事实。

## Canonicalization

vendor package 只拥有 model source，不拥有 registry truth。

主线：

```text
VendorCapabilityPackage(scope)
  -> ModelDefinitionSync(public collection)
  -> platform_model_registry_entries
  -> registry read model / runtime resolution
```

规则：

- vendor-provided rows 必须先 canonicalize 成 model registry stored rows，再进入 registry
- canonicalization 的输出是稳定 `vendor_id + model_id`
- `ModelRef` 一旦产出，就必须是完整 canonical ref
- registry read path 与 runtime resolution 必须共用同一份 stored model definition
- external community catalogs 不再是 canonical registry 主线
- CLI package 的模型列表不参与 canonical registry

## Registry Read Model

registry page 的 item 不是裸 `ModelDefinition`，而是 `ModelRegistryEntry`。

`ModelRegistryEntry` 包含：

- `definition`
  - canonical `ModelDefinition`
- `source_ref`
  - proxy model 指向 direct parent 的 canonical ref
- `badges`
  - 当前 row 自身标签
- `pricing`
  - 当前 row 自身价格
- `sources`
  - stored model definition source observations 的原样投影

规则：

- `definition` 必须来自已经存在的 canonical stored model definition
- `sources` 必须直接来自 stored source observations，management API 不再二次推导
- registry 不再直接展开 historical source 差异；source truth 落在 stored source observations
- 聚合型 source collector 产出的代理模型必须是独立 child row，并通过 `source_ref` 指向 direct canonical model

## List Behavior

- list API 必须从一开始就支持服务端分页
- request 提供：
  - `page_size`
  - `page_token`
  - `filter`
- response 提供：
  - `items`
  - `next_page_token`

`filter` 至少支持：

- `vendor_id`
- `model_id`

## Console Behavior

- registry page 只展示 authoritative package-managed model
- vendor 展示优先使用官方 logo URL
- browser 不允许为了构造 filters 拉取全部 model
- vendor filter 初始是 `All`

## Ownership

- `packages/proto/model/v1/model.proto` 是 canonical model metadata 的唯一 source of truth
- registry page 的 read model 由 management API 定义并投影
- vendor package 只拥有 vendor scope 与 source config
- CLI package 只拥有 access catalogs
