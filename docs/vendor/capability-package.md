# Vendor Capability Package

## Responsibility

`VendorCapabilityPackage` 只负责 vendor-owned static specialization：

- `model_collection`
- `provider_surface_bindings`
- `observability`

它不负责：

- credential auth material
- credential form 默认值
- provider endpoint observed catalog
- registry canonical model truth

## Provider Endpoints

`provider_surface_bindings` 是 vendor API key 路径的 endpoint 模版。

每个 endpoint 自己拥有：

- `config.surface_id`
- `config.display_name`
- `config.kind`
- `config.protocol`
- `config.base_url`
- `catalog`

规则：

- `protocol` / `base_url` 的 owner 是 `ProviderSurfaceBinding.config`
- static model list 的 owner 是 `ProviderSurfaceBinding.catalog`
- `catalog.models[].provider_model_id` 是 endpoint-local model id
- `catalog.models[].model_ref` 只做权威模型绑定
- vendor package 不再提供独立的 `api_key_endpoints`

## Boundary

主线：

```text
vendor package
  -> provider_surface_bindings prefill
  -> frontend may probe/edit model list
  -> provider connect injects auth
  -> create provider endpoint endpoint
  -> endpoint catalog becomes instance-owned truth
```

边界：

- credential 只保存 auth material
- API key credential 只需要 `api_key`
- custom API key 的 `protocol / base_url` 属于 provider endpoint config，不属于 credential
- vendor package 不能通过 credential metadata 间接拥有 endpoint config

## Model Collection

`model_collection` 只表达 vendor-owned authoritative collection 参数。

至少包含 `models`。

规则：

- registry sync 只从这里读取 vendor authoritative source
- endpoint discovery cache 不能直接替代 registry truth

## Model Catalog Capability

模型探测能力归 `platform-model-service` 的 model catalog source registry。
Vendor package 只提供静态输入：

- `model_collection`
- `provider_surface_bindings`
- provider endpoint initial `catalog`

当前主线：

- model-service 按 `VENDOR + vendor_id` 注册可用 catalog capability
- vendor source 可从静态 package 数据、endpoint `/models`、SDK 或其他实现获取模型
- source 输出统一 catalog row：`source_model_id + ModelDefinition`
- 使用方决定结果写 provider catalog、registry observation 或其他结构

规则：

- 是否能探测由 model catalog source registry 判断
- endpoint-local id 使用 `source_model_id`
- canonical model identity 使用 `ModelDefinition.vendor_id + ModelDefinition.model_id`
- provider catalog 存储结构由 provider 侧自己决定

## Read Path

- vendor identity 来自 `vendors/identity` 静态 `vendor_definition.v1.Vendor` registry
- `VendorCapabilityPackage` 读路径按 `vendor_id` materialize vendor metadata，不自带真源

- vendor list：读 `vendors/identity` 静态 registry
- provider connect vendor preset：读 `provider_surface_bindings`
- runtime/provider endpoint：读 instance 自己的 `provider_surface_binding`
- observability builder：读 `observability`

## Resource Notes

`VendorCapabilityPackage` service registry payload 最小字段：

- `model_collection`
- `provider_surface_bindings`
- `observability`

`provider_surface_bindings` 里的 initial catalog 应随 package 一起下发；connect/read path 不应把它裁掉。
