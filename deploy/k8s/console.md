# Console Ingress Base

## Responsibility

这组 manifests 负责把 `console-web` 和 `console-api` 暴露为一个共享的 Console 入口。

## Objects

- `Ingress`

## Runtime Settings

- host
  - `console.localhost`
- path routing
  - `/` -> `console-web`
  - `/api` -> `console-api`

## Notes

- 这是跨 `console-api` 与 `console-web` 的共享入口，不归单个服务 base 持有。
