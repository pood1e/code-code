# Overview Web Package

## Responsibility

- 定义 `overview` feature package 导出的 section metadata 和 route entry，供 shell app 组合。
- 保持 page 实现在 package 内部，不把页面细节泄漏到 app composition 层。
- 用 management read model 汇总 provider / credential readiness，提供首页级 operational summary。

## External Surface

- `OVERVIEW_SECTION`
- `OVERVIEW_SECTIONS`
- `OVERVIEW_ROUTES`

## Implementation Notes

- `OVERVIEW_SECTIONS` 是 package 对 shell 暴露的 navigation truth。
- `OVERVIEW_ROUTES` 只以 lazy route 方式加载 `OverviewPage`，shell app 只消费 route object。
- package 不拥有 shell layout 或其他 domain 页面。
- overview 只消费 management read path，不直接写 provider / credential state。
- provider readiness 摘要基于 `ProviderAccountView.endpoints[].status` 聚合。
- credential readiness 摘要基于 `CredentialView.status.material_ready` 聚合。
- issue card 只下钻到已有 remediation route，不引入新的详情页。
