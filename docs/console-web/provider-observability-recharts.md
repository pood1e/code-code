## responsibility
- 在 `packages/console-web/packages/provider` 内提供 provider observability 的本地仪表盘渲染能力，基于 `Recharts` 显示 quota/runtime 指标。
- 统一将后端返回的 `runtimeMetrics.rows.labels` 解释为 OTel 风格 `attributes`，在 UI 层按 `metricName + unit + attributes + value` 渲染。
- 保持 `SWR` 作为唯一查询与缓存机制，使用 `refreshInterval` 进行后台轮询更新。

## key external fields and methods
- `useProviderAccountObservability(accountId, window, view)`:
  - 输入: `accountId`, `window`, `view`
  - 输出: `detail`, `error`, `isLoading`, `mutate`
- `pullProviderAccountObservability(accountId, window)`:
  - 触发后主动拉取 `view=status` 与 `view=card` 并写入 SWR cache。
- `providerOtelMetricSeries(item, providerSurfaceBindingId)`:
  - 输入: `ProviderOwnerObservabilityItem`, `providerSurfaceBindingId`
  - 输出: OTel 对齐的可视化指标序列（包含 `name`, `unit`, `attributes`, `value`）。

## implementation notes
- 抽屉页面继续使用 Radix 布局组件，图表仅由 `Recharts` 提供。
- `provider_surface_binding_id` 作为默认过滤 attribute；未携带该 attribute 的行保持可见。
- 指标分组优先按 `category`，组内按 `metricName` 稳定排序，避免刷新抖动。
- `SWR` 轮询参数由 `view` 决定:
  - `status`: 高频
  - `card`: 中频
  - `full`: 低频
