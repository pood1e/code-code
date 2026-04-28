# code-code

内部 AI Agent 平台仓库，当前主线是 **Helm-first 部署** 与 **Kubernetes/Temporal 编排**。

详细架构说明请看 [PROJECT.md](./PROJECT.md)，领域设计文档入口请看 [docs/README.md](./docs/README.md)。部署入口和 chart 文档请看 [docs/deploy/README.md](./docs/deploy/README.md)。

## 仓库结构

- `packages/platform-k8s`: 控制平面服务、CRD、控制器、运行时编排
- `packages/console-api`: 控制台 BFF（Go）
- `packages/console-web`: 控制台前端（React）
- `packages/proto`: 跨语言 protobuf 合约
- `deploy/`: 镜像构建、Helm chart、values、部署入口 Makefile
- `docs/`: 设计文档与边界说明

## 本地部署快速开始

前置条件（最小集）：

- `kubectl`
- `helm`
- `bash`
- 可用容器引擎（`docker` 或 `nerdctl`，用于本地构建镜像）

从仓库根目录执行：

```bash
cd deploy
cp .env.example .env

# 1) 启动集群内 registry 和 pull-through cache
make registry-up

# 2) 构建并推送镜像
IMAGE_REGISTRY=<cluster-reachable-registry>/ IMAGE_TAG=dev-local make push

# 3) 通过 Helm 部署主平台 chart
IMAGE_REGISTRY=<cluster-reachable-registry>/ IMAGE_TAG=dev-local make deploy

# 4) 运行 chart 内置 smoke test
make test
make smoke-ingress
```

例如目标机是 `192.168.0.126` 时，可使用 `IMAGE_REGISTRY=192.168.0.126:30500/`。

## 部署入口

- `deploy/Makefile`: 单一部署入口，负责 `build`、`push`、`deploy`、`kiali-operator-up`、`infrastructure-addons-up`、`lint`、`template`、`validate`、`test`、`smoke-ingress`、`scripts-check`、`package-all`、`docs`
- `deploy/charts/`: 7 个 Helm charts，README 由 `helm-docs` 生成
- `deploy/values/`: 共用 values 文件
- `docs/deploy/README.md`: 部署流程、镜像构建、registry、故障排查

## 主要 Charts

- `platform`: 核心业务服务、console ingress、运行时 RBAC、CRD
- `platform-notifications`: 通知子系统
- `infrastructure-core`: Postgres、NATS、OTel Collector、Prometheus、Alertmanager
- `infrastructure-addons`: Grafana、Tempo、Loki、Alloy、Kiali CR/Route、cloudflare-ddns；启用 Kiali 时使用 `make -C deploy infrastructure-addons-up`
- `istio-platform`: 平台托管的 Istio Ambient 资源
- `cluster-bootstrap`: 命名空间和 Gateway API v1.4.0 Experimental CRD
- `dev-image-infra`: 开发/内网环境 registry 和 pull-through cache

## 常用校验

```bash
cd deploy
make lint
make template
make validate
make validate-all
make scripts-check
make package-all
make bake-check
make docs
```
