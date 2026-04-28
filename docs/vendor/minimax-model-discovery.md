# MiniMax Model Discovery

## responsibility

- `provider_surface_bindings[].catalog` 提供 vendor API key connect 的初始 endpoint-local model 集合。

## external surface

- `packages/platform-k8s/internal/supportservice/vendors/support` service registry
- `vendorCapabilityPackage.providerSurfaces[]`
  - `minimax-openai-compatible`
  - `minimax-anthropic`
- `vendorCapabilityPackage.providerSurfaces[].catalog.models[].provider_model_id`

## implementation notes

- `Token Plan` 不是新的 vendor identity；仍然属于 `minimax`。
- `Token Plan API Key` 与 pay-as-you-go API key 不可互换，但当前 repo 里的 credential contract 只表达 `api_key`，不表达 MiniMax plan tier。
- 在没有官方 authenticated model list endpoint、且当前系统不区分 MiniMax access tier 的前提下，默认 static catalog 固定提供 `MiniMax-M2.7`、`MiniMax-M2.7-highspeed`、`MiniMax-M2.5`、`MiniMax-M2.5-highspeed`。
- `minimax-openai-compatible` 与 `minimax-anthropic` 共享同一组 `provider_model_id`。
- 当 MiniMax 提供已文档化的 authenticated model catalog endpoint 后，`minimax` vendor source 可在实现内部补动态探测。
