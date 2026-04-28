# Google Model Discovery

## responsibility

- `google` vendor API key path同时暴露 Gemini native 与 OpenAI-compatible 两个 endpoint。
- model discovery 负责对这两个 protocol endpoint 进行 authenticated models probe，并把返回的 callable model id 写入 endpoint-local catalog / vendor collector source。

## external surface

- `packages/platform-k8s/internal/supportservice/vendors/support` service registry
- `vendorCapabilityPackage.providerSurfaces[]`
  - `google-gemini`
  - `google-gemini-openai-compatible`
- Gemini native models list:
  - `GET https://generativelanguage.googleapis.com/v1beta/models`
- Gemini OpenAI-compatible models list:
  - `GET https://generativelanguage.googleapis.com/v1beta/openai/models`

## implementation notes

- `PROTOCOL_GEMINI` 走官方 Gemini native `models.list`，鉴权头使用 `x-goog-api-key`。
- native `models.list` 响应优先读取 `baseModelId` 作为 endpoint-local `provider_model_id`；缺失时退回 `name` 去掉 `models/` 前缀。
- `PROTOCOL_OPENAI_COMPATIBLE` 继续走 `GET /models` 与 OpenAI models parser。
- Google vendor catalog source 同时支持两个 API endpoints，并复用统一的 API key probe 实现。
- connect review / custom API key probe 不再把 Google 特殊化；统一由 protocol 决定探测路径与鉴权形状。
