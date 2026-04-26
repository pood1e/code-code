# Console Web App Composition

## Responsibility

- 在 shell app 内聚合 feature package 导出的 section 和 route，输出统一 navigation model。
- 根据当前 `pathname` 解析 active section，供 shell layout 高亮导航。

## External Surface

- `SectionKey`
- `APP_SECTIONS`
- `APP_ROUTES`
- `NAV_ITEMS`
- `resolveSection(pathname)`
- `isLlmProviderSectionKey`

## Implementation Notes

- `APP_SECTIONS` 由 feature package 导出的 sections 组成，`NAV_ITEMS` 直接从 section 映射。
- 一个 feature package 可以导出多个 sibling section，例如 `overview` 和 `chat`。
- `APP_ROUTES` 只聚合 feature package 导出的 route，不持有 shell runtime state。
- `resolveSection` 以路径首段匹配 section，未命中时回退到 `OVERVIEW_SECTION`。
