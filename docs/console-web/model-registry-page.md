# Model Registry Page

## Responsibility

- `Model Registry` 主列表只展示 direct models：`source_ref = null`。
- proxy / aggregator models 作为 direct model 的下挂项展示，保留自身 `pricing`、`badges` 和 runtime metadata。

## External Surface

- 列表接口：`platform.model.v1.ModelService/ListModelDefinitions`
- 列表响应 item 是 `ModelRegistryEntry`
- `ModelRegistryEntry` 承载 `definition`、`source_ref`、`badges`、`pricing`、`sources`
- 列表响应还返回 `total_count`，页面据此计算总页数；`page_token` 仍然是服务端分页游标

## Implementation Notes

- 页面状态由 server-side pagination、`model_id_query` search、`vendor_id` filter 和 `source_id` filter 组成。
- `pageToken` 是 management API 自有 opaque token；内部只封装 K8s continue token 和当前 offset。
- `total_count` 由当前 chunk 的 `offset + itemCount + remainingItemCount` 推导，不做全量拉取。
- `model_id_query` 只匹配 canonical `model_id`，语义是 case-insensitive contains，不匹配 display name。
- `source_id` 过滤 direct row 的 `sources[]`，用于快速筛出 `nvidia-integrate`、`modelscope` 等 source 覆盖。
- 主列表固定带 `source_ref=null`。
- 当前页 direct models 的 proxy rows 通过一次聚合 list query 加载：`source_vendor_id in (...) AND source_model_id in (...)`。
- 聚合 query 返回的是 proxy rows 本身；前端再按精确 `source_ref` 分组到对应 direct model 下。
- proxy 展示使用 single-open accordion，不再逐行发请求。
- 详情面板的 source 列表直接使用 `row.sources[]`，显示 source vendor、图标、source id、callable `source_model_id`、badges 与 pricing。
- vendor lookup 同时匹配 `vendor_id + vendor.aliases[]`，用于把 `mistralai`、`moonshotai` 这类 source vendor 归到 canonical vendor 图标。
- vendor filter 初始是 `All`；`VendorCapabilityPackage` 不再承载 registry 默认筛选配置。
- provider endpoint / endpoint 的 observed models 不进入 registry table，只在 provider workflow 内提示未绑定项。
- `CLISpecializationPackage` 不是 registry source；CLI package 只表达 CLI runtime 可消费的模型。
