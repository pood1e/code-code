# Provider Outbound HTTP

## responsibility

- `outboundhttp` 提供 provider-facing outbound request 的默认 `User-Agent`。
- model probe、vendor observability 这类通用 provider HTTP path 复用同一默认值。

## external surface

- `packages/platform-k8s/internal/platform/outboundhttp`
- `outboundhttp.DefaultProviderUserAgent`
- `outboundhttp.SetDefaultProviderUserAgent`

## implementation notes

- 只在 caller 没有显式声明 `User-Agent` 时注入默认值。
- vendor-specific request 如果需要模拟官方 client，继续由 caller 自己覆盖。
