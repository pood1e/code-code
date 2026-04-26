## responsibility

- 承接 provider observability 中的 runtime gauge metric 展示
- 对外返回 metric datapoint rows，而不是预设固定维度结构
- owner-specific card 在前端按 labels 自行选择和映射

## key fields

- `runtimeMetrics[].metricName`
- `runtimeMetrics[].rows[].labels`
- `runtimeMetrics[].rows[].value`

## implementation notes

- `runtimeMetrics[].metricName` 对外返回 canonical OTel 风格命名；内部 Prometheus storage 名由服务端映射。
- active collector 使用 `gen_ai.provider.quota.*` / `gen_ai.provider.usage.*`；passive response header 采集使用 `gen_ai.provider.runtime.*`。
- row labels 直接来自 Prometheus sample labels
- 不预设 `model_id`、`provider_surface_binding_id` 或其他维度
- summary 不把 labeled runtime gauge rows 强行聚合成单个 scalar
- account detail 保留原始 labeled rows，owner-specific card 本地按 labels 过滤
