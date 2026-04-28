# Deploy

Single entrypoint for building images and deploying the code-code platform via Helm.

## Layout

```
deploy/
├── Makefile               单一入口：build / push / deploy / lint / validate / test / smoke / registry-up
├── .env.example           复制为 .env 设置 IMAGE_REGISTRY / IMAGE_TAG 等
├── images/
│   ├── docker-bake.hcl    多架构 buildx bake 定义
│   └── release/*.Dockerfile
├── charts/
│   ├── README.md.gotmpl          共享 helm-docs 模板
│   ├── platform/                 主业务 chart（平台服务 + console/showcase + ingress）
│   ├── platform-notifications/   通知子系统（可选）
│   ├── infrastructure-core/      Postgres / NATS / OTel collector
│   ├── infrastructure-addons/    Grafana / Tempo / Kiali / cloudflare-ddns（可选）
│   ├── istio-platform/           Istio CR
│   ├── cluster-bootstrap/        命名空间 + Gateway API v1.4.0 Experimental CRD
│   └── dev-image-infra/          自建 docker registry + 上游缓存（开发/内网用）
└── agents/                Agent runtime 镜像源（详见 agent-images.md）
```

## Quick start (单机内网部署，目标机 192.168.0.126)

```bash
cd deploy
cp .env.example .env       # 编辑 IMAGE_REGISTRY / IMAGE_TAG 等

# 1. 在集群中起 docker registry:2 + 上游缓存（NodePort 30500）
make registry-up

# 2. 构建并推送镜像
IMAGE_REGISTRY=192.168.0.126:30500/ IMAGE_TAG=$(git rev-parse --short HEAD) \
  make push

# 3. 部署平台（失败会自动 rollback）
IMAGE_REGISTRY=192.168.0.126:30500/ IMAGE_TAG=$(git rev-parse --short HEAD) \
  make deploy

# 4. 跑连通性 smoke test
make test
make smoke-ingress
```

`make help` 列出全部 target。

## Upstream baseline

- Kubernetes target: Istio-supported Kubernetes `1.31` through `1.35`.
- Istio Ambient: official Helm charts at `1.29.2` (`base`, `istiod`, `cni`, `ztunnel`).
- Gateway API: `v1.4.0` Experimental channel CRDs bundled in `cluster-bootstrap`.

## Image build pipeline

| Target           | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `make build`     | `docker buildx bake --pull --load`，只构建当前主机架构并加载到本地 docker。 |
| `make push`      | `docker buildx bake --pull --push`，按 `IMAGE_PLATFORMS` 推送多架构镜像，要求 `IMAGE_REGISTRY` 非空。 |
| `make bake-print`| 打印 buildx bake 解析后配置，调试 bake 用。              |
| `make bake-check`| 运行 Docker Buildx 静态检查。                            |
| `make bake-check-remote` | 只传最小检查上下文，在 `REMOTE_DOCKER_HOST` 上运行 Docker Buildx 静态检查。 |

`docker-bake.hcl` 默认构建 group：

- `default`：所有随 `charts/platform` 部署的镜像 + agent runtime + sidecar
- `platform`：平台后端和前端服务镜像集合
- `runtime`：仅 agent runtime 镜像（claude-code / qwen / gemini / cli-output-sidecar）
- `optional`：`notification-dispatcher` / `wecom-callback-adapter`，默认不构建

切换 group 用 `BAKE_TARGET=platform make build`。

`make build` 默认使用 `LOCAL_PLATFORM=linux/<host-arch>`，避免 `--load` 加载多架构 manifest 失败。`make push` 默认使用 `IMAGE_PLATFORMS=linux/amd64,linux/arm64`。

Agent CLI 镜像默认 pin 到当前稳定 npm 版本：Claude Code `2.1.121`、Qwen Code `0.15.4`、Gemini CLI `0.39.1`。需要覆盖时使用 `CLAUDE_CODE_CLI_VERSION`、`QWEN_CLI_VERSION`、`GEMINI_CLI_VERSION`。

## Helm deployment

| Target           | What it does                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `make lint`      | `helm lint` chart。                                                  |
| `make lint-all`  | 对所有 chart 运行 `helm lint`。                                      |
| `make template`  | `helm template`，渲染到 stdout 用于审阅。                              |
| `make template-all` | 渲染所有 chart 到 `/tmp` 下的临时目录。                            |
| `make validate`  | `helm template` + `kubeconform -strict`（默认通过 `go run` 调用 kubeconform）。 |
| `make validate-all` | 对所有 chart 运行 `helm template` + `kubeconform`。               |
| `make gateway-api-crds-apply` | 用 Kubernetes server-side apply 安装/更新 Gateway API CRD bundle。 |
| `make diff`      | `helm diff upgrade`（需先安装 helm-diff 插件）。                       |
| `make deploy`    | `helm upgrade --install --atomic --wait --timeout 5m`，失败自动回滚。 |
| `make test`      | `helm test`：运行 chart 内置连通性 smoke test。                        |
| `make smoke-ingress` | 检查 console/showcase/Grafana/Kiali URL、HTTPRoute 条件、Kiali validation 和平台命名空间 `istioctl analyze`。 |
| `make smoke-egress` | 检查 egress access-set 生命周期、L4 direct/proxy、L7 header rewrite。 |
| `make smoke-egress-full` | 运行完整 egress smoke，包括 telemetry 和 dynamic ext_authz。 |
| `make rollback`  | `helm rollback` 到上一个 revision。                                    |
| `make uninstall` | `helm uninstall` release。                                            |

要部署的 chart / release / namespace / values 由 `Makefile` 顶部变量决定，可通过 `.env` 覆盖。当前默认指向 `charts/platform`。`make deploy` 会拒绝旧的 `deploy/k8s/charts` 路径，避免旧 manifest 覆盖当前 Gateway API 配置。其他 chart（`infrastructure-core`、`platform-notifications` 等）通过 `make -C deploy deploy CHART_DIR=charts/<name> RELEASE=<release> NAMESPACE=<namespace> VALUES=charts/<name>/examples/<file>.yaml` 部署，参考各 chart 的 README。

## Maintenance

| Target      | What it does                               |
| ----------- | ------------------------------------------ |
| `make docs` | 运行 `helm-docs` 重新生成 8 个 chart 的 README。 |
| `make package-all` | 打包所有 chart 到 `deploy/tmp/charts`。 |
| `make scripts-check` | 对 deploy smoke 脚本运行 `bash -n`；本机存在 `shellcheck` 时一并运行。 |
| `make clean` | 清理 `deploy/tmp` 和 release 临时目录。 |


## Self-hosted registry

`charts/dev-image-infra` 提供一个集群内 `docker registry:2` Deployment + 上游 cache（docker.io / registry.k8s.io / quay.io）。

```bash
make registry-up      # 启动
make registry-status  # 看 NodePort
make registry-down    # 卸载
```

NodePort 默认：`registry=30500, docker.io cache=30502, registry.k8s.io cache=30503, quay.io cache=30504`。

在目标机 `192.168.0.126` 上访问：`http://192.168.0.126:30500/v2/_catalog`。

K3s 节点要把这个 registry 配到 `/etc/rancher/k3s/registries.yaml`，参考 `charts/dev-image-infra/README.md`（之前的 `k3s-registry-mirrors.md` 已合并到这里）。

## Required external resources before `make deploy`

由 `charts/platform/templates/NOTES.txt` 在 `helm install` 后打印；摘要：

| Kind      | Name                                  | Purpose                  |
| --------- | ------------------------------------- | ------------------------ |
| Secret    | `postgres-auth`                       | DATABASE_URL             |
| ConfigMap | `code-code-egress-trust-bundle`       | TLS trust bundle         |

可选：`console-tls-placeholder`（TLS 启用时）、`cli-runtime-image-build-registry-auth`（CLI runtime 构建用）、`platform-*-internal-action`（启用 internal-action bearer 时）。

## Troubleshooting

- **`ImagePullBackOff`**：检查 `make push` 是否成功推到 `IMAGE_REGISTRY`，检查目标机能否访问 `IMAGE_REGISTRY`，以及 K3s `registries.yaml` 是否包含该 registry 的 `tls.insecure_skip_verify=true`（HTTP registry 时）。
- **多架构构建失败**：`docker buildx create --use --bootstrap` 创建 buildx builder；本地 `make build` 默认只加载 `LOCAL_PLATFORM`，多架构发布走 `make push`。
- **`helm upgrade` 卡住**：`make status`、`kubectl -n code-code describe pod`；`--atomic` 会在 `--timeout` 后自动回滚。
- **`helm test` 失败**：`kubectl -n code-code logs pod/code-code-platform-connection-test`。
- **入口被旧配置覆盖**：运行 `make smoke-ingress`；它会确认 `console` HTTPRoute 在 `code-code-console`、`showcase` HTTPRoute 在 `code-code-showcase`，并检查 Kiali validation 与平台命名空间 `istioctl analyze` 基线。
- **values 校验报错**：检查 `charts/platform/values.schema.json`，所有顶层字段都必填。

## See also

- `agent-images.md` — agent runtime 镜像源代码与 entrypoint 约定
- `console-ingress.md` — 平台 Istio Gateway / HTTPRoute 入站路由约定
- 各 chart 的 `README.md`（`charts/<name>/README.md`）
