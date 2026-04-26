## responsibility

- `provider_card.enabled` 标记一个 owner-owned capability
- `OAuthSpecialization` 和 `VendorCapabilityPackage` 都可以声明自己拥有 provider card
- card 的具体展示语义不在 shared proto 里预设
- console-web 按 owner implementation 渲染原生卡片内容

## key fields

- `oauth.provider_card.enabled`
- `vendor_capability_package.provider_card.enabled`

## implementation notes

- shared contract 只声明 ownership，不预设 quota/model usage/item DSL
- 前端 registry 直接按强类型 owner identity dispatch：`{ kind: "cli", cliId }` / `{ kind: "vendor", vendorId }`
- CLI / API key path 各自决定 card summary 的实现方式
- owner 可以读取自己的特化 observability metric，再在本地映射成原生 card 文案
- 列表卡片走原生 UI
