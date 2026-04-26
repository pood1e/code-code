## responsibility

- 为 `packages/console-web/app` 初始化浏览器侧 OTel tracing + metrics 主线。
- 自动采集页面加载、`fetch`、`xhr`，并向 OTLP HTTP exporter 发送 telemetry。
- 采集 Web Vitals 与前端错误事件，统一通过 OTel metric/span 上报。

## key external fields and methods

- `initializeConsoleWebTelemetry()`
- `recordConsoleWebRouteChange(path)`
- `recordConsoleWebError(source, error)`
- `VITE_OTEL_ENABLED`
- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
- `VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `VITE_OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`

## implementation notes

- endpoint 优先级：`*_TRACES_ENDPOINT`/`*_METRICS_ENDPOINT` > `OTLP_ENDPOINT + /v1/*`。
- 未配置 exporter endpoint 时默认禁用 telemetry，避免无效上报。
- `HashRouter` 场景下 route 指标使用 `location.pathname + location.search`。
- `ErrorBoundary` 与 `window` 全局错误均记录到统一 error counter 与 error span。
