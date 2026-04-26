## responsibility

为 `gemini-cli` 与 `antigravity` 提供 Google OAuth 下的动态模型可用性探测。

## key fields

- `oauth.model_catalog.default_catalog`
- `modelcatalogsources/clis`
- `credential secret.project_id`

## notes

- `gemini-cli` 通过 `retrieveUserQuota` 读取 `buckets[].modelId`
- `antigravity` 通过 `fetchAvailableModels` 读取 `models` map key
- `antigravity` 仅保留稳定产品模型前缀，过滤 `chat_*` 一类 opaque key
- probe 结果优先作为 availability filter
- package `default_catalog` 继续提供稳定 metadata 与 fallback
