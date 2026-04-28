# Fireworks Model Discovery

## responsibility

- `fireworks-ai` vendor preset 负责提供 Fireworks API key endpoint 模版。
- Fireworks model discovery 主线只用于 provider connect 的 endpoint-local catalog 预填充。

## external surface

- `packages/platform-k8s/internal/supportservice/vendors/support` service registry
- `vendorCapabilityPackage.providerSurfaces[].config`
  - `fireworks-ai-openai-compatible`
- Fireworks OpenAI-compatible endpoint:
  - `https://api.fireworks.ai/inference/v1`
- Fireworks OpenAI-compatible models list:
  - `GET https://api.fireworks.ai/inference/v1/models`
- Fireworks control-plane public serverless catalog:
  - `GET https://api.fireworks.ai/v1/accounts/fireworks/models?filter=supports_serverless=true`

## implementation notes

- connect 阶段的模型探测继续复用现有 OpenAI-compatible protocol probe，不为 Fireworks 新开探测主线。
- 该探测返回的是“当前 API key 可见模型”，天然适合 endpoint-local onboarding prefill。
- `fireworks-ai` catalog source 内部可复用 authenticated `/models` collector。
- `authority_priority` 显式高于 repo 里的聚合 source，避免 Fireworks 自己的 direct account-visible model list 被低优先级聚合 source 抢主。
- Fireworks 同时存在 public serverless models 与 account-private custom models；当前主线接受 canonical registry 落这类 account-visible models，source truth 由 catalog source authority priority 收敛。
