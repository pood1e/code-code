# code-code

内部 AI Agent 平台仓库，当前主线是 **Helm-first 部署** 与 **Kubernetes/Temporal 编排**。

详细架构说明请看 [PROJECT.md](./PROJECT.md)，领域设计文档入口请看 [docs/README.md](./docs/README.md)。

## 仓库结构

- `packages/platform-k8s`: 控制平面服务、CRD、控制器、运行时编排
- `packages/console-api`: 控制台 BFF（Go）
- `packages/console-web`: 控制台前端（React）
- `packages/proto`: 跨语言 protobuf 合约
- `deploy/`: 镜像构建与 Helm/K8s 部署脚本
- `docs/`: 设计文档与边界说明

## 快速开始（本地）

前置条件（最小集）：

- `kubectl`
- `helm`
- `bash`
- 可用容器引擎（`docker` 或 `nerdctl`，用于本地构建镜像）

常用流程：

```bash
# 1) 初始化本地 registry 等依赖
deploy/local.sh setup

# 2) 一键本地开发部署（按需 build/push/deploy）
deploy/dev.sh up

# 3) 查看状态
deploy/dev.sh status
```

如果只想执行某一步：

```bash
deploy/dev.sh build
deploy/dev.sh push
deploy/dev.sh deploy
```

## 访问入口（默认）

- `console.localhost`
- `kiali.localhost`
- `grafana.localhost`

如需绑定到固定局域网 IP，可设置 `LOCAL_INGRESS_BIND_IP`，脚本会生成 `*.nip.io` 主机名。

## 部署脚本

- `deploy/dev.sh`: 开发入口脚本（setup/build/push/deploy/addon/status/logs）
- `deploy/local.sh`: 本地环境初始化（registry、Colima inotify 参数等）
- `deploy/release.sh`: CI/发布向脚本（build/push/deploy/validate/package-charts）

## Helm Charts（deploy/k8s/charts）

- `platform`: 核心业务服务与 CRD
- `istio-platform`: 网格相关资源（waypoint/telemetry/wasm 等）
- `infrastructure-core`: Postgres/NATS/Prometheus/OTel 等核心依赖
- `infrastructure-addons`: Grafana/Kiali/Tempo/Loki/Alloy/Cloudflare-DDNS 等
- `cluster-bootstrap`: 命名空间与集群基础资源
- `cluster-addons`: 集群附加组件（如 metrics-server）
- `dev-image-infra`: 开发环境镜像基础设施（registry/cache）
- `platform-notifications`: 通知子系统

## 校验

```bash
deploy/release.sh validate
```

