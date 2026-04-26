# Google AI Studio Session Quota

## responsibility

- 通过 AI Studio browser session 调用内部 quota endpoint
- `project_id` 字段优先填写 Google Cloud project number（`projects/<number>` 或纯数字）作为 quota project path
- 仅在 `project_id` 不是 path/数字时，通过 `ListCloudProjects` 解析 `gen-lang-client-*`
- 将 current tier 的模型级 quota limit 投影为 provider observability metrics
- 复用 vendor active-query runner，不走 inference API key 或 Google OAuth 路线

## key fields

- `VendorCapabilityPackage.observability.active_query.collector_id = google-aistudio-quotas`
- `UpdateProviderObservabilityAuthentication.session_material`
- `session.values.cookie`
- `session.values.page_api_key`
- `session.values.project_id`：UI 展示为 Project number，兼容 `gen-lang-client-*`
- `session.values.origin`

## notes

- collector 认证依赖 AI Studio session cookie、页面 `X-Goog-Api-Key` 与 `project_id`
- 最小实测 cookie 集合是 `SID`、`HSID`、`SSID`、`SAPISID`，以及 `__Secure-1PAPISID` 或 `__Secure-3PAPISID`
- collector 从 `cookie` 提取 `SAPISID` / `__Secure-1PAPISID` / `__Secure-3PAPISID`，按秒级时间戳重算 `SAPISIDHASH` / `SAPISID1PHASH` / `SAPISID3PHASH`
- `ListCloudProjects` 请求体是 `[]`（仅 fallback 解析 `gen-lang-client-*` 时调用）
- `ListQuotaModels` 请求体是 `[]`
- `ListModelRateLimits` 请求体是 `["projects/<number>"]`；当 `project_id` 为纯数字时会自动补 `projects/` 前缀
- response 先按 JSON 解析，失败后按 base64 包裹再解 JSON
- `ListQuotaModels` 提供模型目录与 preview alias；`ListModelRateLimits` 提供 tier-specific limit rows
- collector 仅保留 `ListModelRateLimits` 中可展示的文本模型：category=4 的文本输出模型，以及 `gemma-*` 模型；同时只采集正数 limit
- collector 为 quota metrics 标记 `model_category=text_output|gemma`，前端只消费带该 label 的 Google quota rows
- collector 基于 `ListModelRateLimits` 产出 authoritative `limit` 与 `reset`
- collector 对最多 5 个 RPD 文本输出模型额外调用 `GetModelQuota`，best-effort 产出 `remaining`
- `origin` 固定默认 `https://aistudio.google.com`
- provider observability update 写 account-owned session credential；runner 将完整 session material 传给 collector
- provider connect 不再内联 observability token；AI Studio session 只在 account 维度单独维护
