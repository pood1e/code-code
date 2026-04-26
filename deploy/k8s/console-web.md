# Console Web Kubernetes Base

## Responsibility

这组 manifests 负责把 `console-web` 作为 namespaced web service 部署到 Kubernetes。

## Objects

- `Deployment`
- `Service`

## Runtime Settings

- container port
  - `8080`
- health
  - `/healthz`

## Notes

- 这是前端静态页面服务，不需要访问 Kubernetes API。
