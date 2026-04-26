# Grafana Sidebar Integration

## Responsibility

- 在 console shell 内提供一个可选的 `Grafana` 侧栏入口。
- 只在 Grafana 实际可达时显示侧栏项；Grafana 不可用时不影响其他 console 路由。
- 保持 Grafana 仍然是独立服务，console 只负责探测可用性和 iframe 承载。

## External Surface

- section key: `grafana`
- route: `/grafana`
- views:
  - `cluster`: cluster resource usage
  - `services`: platform service health
- runtime env: `VITE_GRAFANA_BASE_URL`，默认 `/grafana`
- health probe: `GET <grafana-base-url>/api/health`
- deployment requirement: Grafana 需要允许 iframe 嵌入

## Implementation Notes

- shell app 启动后探测 Grafana health；只有 probe 成功时才把 `Grafana` 放进侧栏导航。
- `#/grafana` 保持在 console shell 内渲染，但主区切到 full-bleed mode，去掉 shell 默认的 max-width、padding 和顶部间距。
- Grafana URL 只做路径归一化，不把 Grafana 变成 console 的强依赖；probe 失败直接视为 unavailable。
- 侧栏页直接 iframe 两个已有 dashboard：`code-code-cluster-resources` 和 `code-code-platform-services`，分别作为 `Cluster Resources` 和 `Service Health` 两个 tab。
- 反向代理必须在 console 使用的同一 host 上显式把 `/grafana` 前缀路由到 Grafana；否则 `/grafana` 会被 console 自己的 `/` 路径吞掉。
- 部署需要显式开启 `GF_SECURITY_ALLOW_EMBEDDING=true`，否则浏览器会拒绝 iframe。
