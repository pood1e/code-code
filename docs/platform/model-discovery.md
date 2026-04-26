# Model Discovery

## Responsibility

model discovery 只存在于 onboarding 预填充阶段。
它不再是 management RPC，也不是持久化资源；它的唯一产物是 `ConnectProvider.api_key.endpoint_model_catalogs`。

## Flow

```text
frontend
  -> derive endpoint templates
  -> optional protocol probe
  -> batch registry match
  -> endpoint-scoped provider model entries
  -> frontend-only state
  -> ConnectProvider(endpoint_model_catalogs)
  -> ProviderSurfaceBinding.catalog persisted
```

## Discovery Sources

- vendor API key:
  - endpoint template 来自 `VendorCapabilityPackage.provider_surface_bindings`
  - 初始 prefill 来自 endpoint 自带 `catalog.models[]`
  - 若 endpoint protocol 支持探测，frontend 可再补一轮协议探测并回填 `model_ref`
- custom API key:
  - user 显式提供 `base_url`、`protocol`、`api_key`
  - frontend 按协议探测模型并组装一个 manual endpoint catalog
- CLI OAuth:
  - 不做预探测
  - endpoint model catalog 在 OAuth 完成后由 CLI specialization package + artifact 决定

## Rules

- discovery state 只存在于 frontend
- 持久化面只写 endpoint 维度的 `provider_model_id + optional model_ref`
- registry 匹配是 best-effort；命中才填 `model_ref`
- discovery 不写 `ModelDefinition`
- discovery 不写 provider endpoint status
- discovery 不写 `VendorCapabilityPackage.model_collection`
- backend 不保留 discovery cache

## Failure Behavior

- 认证失败、网络失败、协议失败：frontend 当前预填充失败，不能提交依赖该 catalog 的 connect 请求
- provider 返回的模型若无法匹配 registry：保留 `provider_model_id`，只对命中项补全 `model_ref`
- operator 仍然可以手工编辑 endpoint model list，再提交 `ConnectProvider`
