# LLMProvider Model Linkage

## responsibility

`provider` 与 `model` 的边界收敛为两层：

- `ProviderSurfaceBinding.catalog`
  - owner: provider endpoint
  - truth: endpoint 当前可调用的 model entries
- `ModelDefinition`
  - owner: registry
  - truth: authority model identity

## endpoint catalog

持久化面只保留一份：

- `ProviderSurfaceBinding.runtime.catalog.models[]`

每个 entry:

- `provider_model_id`
- `model_ref` optional

规则：

- `provider_model_id` 是 endpoint 本地路由 id
- `model_ref` 是 authority binding
- endpoint catalog 不保存 provider raw metadata
- endpoint catalog 不要求每个 entry 都绑定 authority model

## discovery

不再有独立的 discovery RPC。

预填充阶段负责：

- 用当前 auth material 预填充 endpoint models
- 返回或组装 endpoint 维度的 `provider_model_id + optional model_ref`

它不负责：

- 写 provider status
- 写 model registry
- 持久化“上一次探测结果”

## connect

`ConnectProvider` 负责：

- 校验 connect payload
- 创建 credential
- 物化最终 `ProviderSurfaceBinding`
- 把 endpoint catalog 持久化到 instance spec

规则：

- vendor API key path 从 vendor package 预填充 endpoint templates
- custom API key path 创建 manual endpoint
- operator 后续仍然可以编辑 endpoint model list

## runtime

runtime 只消费 endpoint catalog：

- `ListModels()` 从 `ProviderSurfaceBinding.catalog.models[]` 构造 runtime catalog
- 真实调用按 `provider_model_id` 路由
- 若 entry 带 `model_ref`，runtime 再补 authority model 信息

## status

`ProviderSurfaceBinding.status` 只保留：

- `phase`
- `reason`

status 校验只关注：

- definition / credential 是否可解析
- endpoint catalog entry 是否合法
