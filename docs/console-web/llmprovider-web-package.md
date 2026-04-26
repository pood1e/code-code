# LLM Provider Web Package

## Responsibility

- `console-web-provider` 拥有 shell 内的 provider 和 model registry surface。
- package 定义 section metadata、lazy routes、package-local API adapter 和 domain UI。
- provider connect flow 保持在 `Providers` 页面内完成，不拆独立 add page。

## External Surface

- `LLM_PROVIDER_SECTIONS`
- `LLM_PROVIDER_SECTION_BY_KEY`
- `isLlmProviderSectionKey(value)`
- `LLM_PROVIDER_ROUTES`

## Implementation Notes

- shell app 只消费 sections 与 routes，不持有 provider / model 页面细节。
- 当前 routes 为 `providers`、`models` 和 `provider-credentials/oauth/callback`。
- `Providers` 页面负责 connect flow、detail dialog 和 observed model binding gap surface。
- provider card 只显示一个主 icon。
- provider card endpoint 摘要只显示 `protocol + base_url`。
- CLI OAuth account 摘要只读取 `ProviderAccountView.credential_subject_summary`。
- `Providers` 页保留 `Vendor API Key`、`Custom API Key` 和 `CLI OAuth` 直接入口；session 恢复仍然走同一个 dialog state。
- `Providers` 页 URL 可以携带 account / credential focus state，用于从 overview 下钻到现有 remediation surface。
- provider list row 始终进入 provider account 视图；endpoint 详情从 account 内继续下钻。
- connect flow 先展示 discovered model list，再通过 progressive disclosure 暴露 advanced editing。
- advanced endpoint model editing 可以查询 `Model Registry` 按 canonical `model_id` 过滤候选，并把空的 endpoint model id 预填成所选 canonical id。
- `Models` 页面只面向 canonical registry query，不混入 raw observed catalog。
