# deploy/Makefile — 单一构建/部署入口。
# 依赖：docker (with buildx), helm, kubectl, go.
# 可选：shellcheck（scripts-check 会在存在时运行）。
#
# 常用流程：
#   make help                         查看所有 target
#   make registry-up                  在集群中启动 dev image registry (NodePort 30500)
#   IMAGE_REGISTRY=192.168.0.126:30500/ IMAGE_TAG=$(git rev-parse --short HEAD) make push
#   IMAGE_REGISTRY=192.168.0.126:30500/ IMAGE_TAG=$(git rev-parse --short HEAD) make deploy
#   make test
#
# 通过 deploy/.env 自动加载默认变量（.env.example 是模板）。

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

DEPLOY_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
REPO_ROOT  := $(abspath $(DEPLOY_DIR)/..)

# Auto-load .env if present.
ifneq (,$(wildcard $(DEPLOY_DIR)/.env))
include $(DEPLOY_DIR)/.env
export
endif

# --- Tunables (override on the CLI or via .env) ---

CHART_DIR     ?= $(DEPLOY_DIR)/charts/platform
RELEASE       ?= code-code-platform
NAMESPACE     ?= code-code
VALUES        ?= $(CHART_DIR)/examples/local.yaml
TIMEOUT       ?= 5m

IMAGE_REGISTRY ?=
IMAGE_TAG      ?= dev-local
IMAGE_PLATFORMS ?= linux/amd64,linux/arm64
LOCAL_ARCH ?= $(shell uname -m | sed -e 's/^x86_64$$/amd64/' -e 's/^aarch64$$/arm64/')
LOCAL_PLATFORM ?= linux/$(LOCAL_ARCH)
CLAUDE_CODE_CLI_VERSION ?= 2.1.121
QWEN_CLI_VERSION        ?= 0.15.4
GEMINI_CLI_VERSION      ?= 0.39.1

BAKE_FILE   := $(DEPLOY_DIR)/images/docker-bake.hcl
BAKE_TARGET ?= default

REGISTRY_RELEASE   ?= code-code-registry
REGISTRY_NAMESPACE ?= code-code-infra
REGISTRY_CHART     := $(DEPLOY_DIR)/charts/dev-image-infra
REGISTRY_HELM_ARGS ?=

HELM    ?= helm
HELM_DOCS ?= go run github.com/norwoodj/helm-docs/cmd/helm-docs@v1.14.2
KUBECONFORM ?= go run github.com/yannh/kubeconform/cmd/kubeconform@v0.7.0
KUBECTL ?= kubectl
DOCKER  ?= docker
CURL    ?= curl
JQ      ?= jq
ISTIOCTL ?= istioctl
SHELLCHECK ?= shellcheck
SSH ?= ssh
TAR ?= tar
BUILDX  := $(DOCKER) buildx

CHART_DIR_PATH := $(if $(filter /%,$(CHART_DIR)),$(CHART_DIR),$(DEPLOY_DIR)/$(CHART_DIR))
VALUES_PATH    := $(if $(filter /%,$(VALUES)),$(VALUES),$(DEPLOY_DIR)/$(VALUES))

IMAGE_REGISTRY_NORMALIZED := $(patsubst %/,%,$(IMAGE_REGISTRY))
IMAGE_REGISTRY_PREFIX     := $(if $(IMAGE_REGISTRY_NORMALIZED),$(IMAGE_REGISTRY_NORMALIZED)/,)

BAKE_ENV_COMMON := IMAGE_REGISTRY="$(IMAGE_REGISTRY_PREFIX)" IMAGE_TAG="$(IMAGE_TAG)" CLAUDE_CODE_CLI_VERSION="$(CLAUDE_CODE_CLI_VERSION)" QWEN_CLI_VERSION="$(QWEN_CLI_VERSION)" GEMINI_CLI_VERSION="$(GEMINI_CLI_VERSION)"
BAKE_ENV_LOCAL := $(BAKE_ENV_COMMON) DEFAULT_PLATFORMS="$(LOCAL_PLATFORM)"
BAKE_ENV_PUSH := $(BAKE_ENV_COMMON) DEFAULT_PLATFORMS="$(IMAGE_PLATFORMS)"
BAKE_OPTS := -f $(BAKE_FILE)

REMOTE_DOCKER_HOST ?= pood1e@192.168.0.126
REMOTE_BAKE_CONTEXT ?= /tmp/code-code-bake-check
REMOTE_BAKE_ARCHIVE ?= /tmp/code-code-bake-check.tar.gz
REMOTE_BAKE_PLATFORM ?= linux/amd64
BAKE_CHECK_CONTEXT_PATHS := .dockerignore deploy/Makefile deploy/images deploy/agents/common deploy/agents/claude-code deploy/agents/qwen-cli deploy/agents/gemini-cli deploy/agents/sidecars/cli-output

KUBERNETES_VERSION ?= 1.35.0
KUBECONFORM_SCHEMA_LOCATIONS ?= default $(DEPLOY_DIR)/schemas/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json
KUBECONFORM_SCHEMA_ARGS = $(foreach location,$(KUBECONFORM_SCHEMA_LOCATIONS),-schema-location '$(location)')
KUBECONFORM_FLAGS ?= -kubernetes-version "$(KUBERNETES_VERSION)" -strict -ignore-missing-schemas -summary $(KUBECONFORM_SCHEMA_ARGS)
GATEWAY_API_CRDS ?= $(DEPLOY_DIR)/charts/cluster-bootstrap/crds/gateway-api-v1.4.0-experimental-install.yaml

HELM_SET_IMAGE = $(if $(shell test -f '$(CHART_DIR_PATH)/values.schema.json' && grep -q '"imageRegistry"' '$(CHART_DIR_PATH)/values.schema.json' && printf yes),--set global.imageRegistry='$(IMAGE_REGISTRY_NORMALIZED)' --set global.imageTag='$(IMAGE_TAG)')

CONSOLE_ROUTE_NAMESPACE ?= code-code-console
SHOWCASE_ROUTE_NAMESPACE ?= code-code-showcase
OBSERVABILITY_ROUTE_NAMESPACE ?= code-code-observability
PLATFORM_GATEWAY_NAMESPACE ?= code-code-net
PLATFORM_GATEWAY_NAME ?= platform-ingress

CONSOLE_URL ?= http://console.192.168.0.126.nip.io:30599/
SHOWCASE_URL ?= http://showcase.192.168.0.126.nip.io:30599/
GRAFANA_URL ?= http://grafana.192.168.0.126.nip.io:30599/login
KIALI_URL ?= http://kiali.192.168.0.126.nip.io:30599/
KIALI_BASE_URL ?= http://kiali.192.168.0.126.nip.io:30599
ANALYZE_NAMESPACES ?= code-code code-code-net code-code-console code-code-showcase code-code-observability

KIALI_OPERATOR_RELEASE ?= kiali-operator
KIALI_OPERATOR_NAMESPACE ?= code-code-observability
KIALI_OPERATOR_CHART ?= kiali/kiali-operator
KIALI_OPERATOR_VERSION ?= 2.25.0
KIALI_OPERATOR_VERSION_ARG = $(if $(KIALI_OPERATOR_VERSION),--version "$(KIALI_OPERATOR_VERSION)")
KIALI_OPERATOR_IMAGE_REPO ?= quay.io/kiali/kiali-operator
KIALI_OPERATOR_IMAGE_TAG ?= v2.25.0
KIALI_OPERATOR_IMAGE_PULL_POLICY ?= IfNotPresent
KIALI_OPERATOR_TIMEOUT ?= 10m
KIALI_OPERATOR_HELM_ARGS ?=

INFRASTRUCTURE_ADDONS_RELEASE ?= code-code-infrastructure-addons
INFRASTRUCTURE_ADDONS_NAMESPACE ?= code-code
INFRASTRUCTURE_ADDONS_CHART ?= $(DEPLOY_DIR)/charts/infrastructure-addons
INFRASTRUCTURE_ADDONS_VALUES ?= $(DEPLOY_DIR)/charts/infrastructure-addons/examples/observability.yaml
INFRASTRUCTURE_ADDONS_TIMEOUT ?= 10m
INFRASTRUCTURE_ADDONS_HELM_ARGS ?=

##@ General

.PHONY: help
help: ## 列出所有 target
	@awk 'BEGIN {FS = ":.*?##"; printf "Usage: make <target>\n"} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next} \
		/^[a-zA-Z0-9_-]+:.*?##/ {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-config
print-config: ## 打印当前生效的变量
	@printf "REPO_ROOT       = %s\n" "$(REPO_ROOT)"
	@printf "DEPLOY_DIR      = %s\n" "$(DEPLOY_DIR)"
	@printf "CHART_DIR       = %s\n" "$(CHART_DIR_PATH)"
	@printf "RELEASE         = %s\n" "$(RELEASE)"
	@printf "NAMESPACE       = %s\n" "$(NAMESPACE)"
	@printf "VALUES          = %s\n" "$(VALUES_PATH)"
	@printf "IMAGE_REGISTRY  = %s\n" "$(IMAGE_REGISTRY_NORMALIZED)"
	@printf "IMAGE_TAG       = %s\n" "$(IMAGE_TAG)"
	@printf "LOCAL_PLATFORM  = %s\n" "$(LOCAL_PLATFORM)"
	@printf "IMAGE_PLATFORMS = %s\n" "$(IMAGE_PLATFORMS)"
	@printf "BAKE_TARGET     = %s\n" "$(BAKE_TARGET)"
	@printf "CLAUDE_CODE_CLI_VERSION = %s\n" "$(CLAUDE_CODE_CLI_VERSION)"
	@printf "QWEN_CLI_VERSION        = %s\n" "$(QWEN_CLI_VERSION)"
	@printf "GEMINI_CLI_VERSION      = %s\n" "$(GEMINI_CLI_VERSION)"
	@printf "KUBERNETES_VERSION      = %s\n" "$(KUBERNETES_VERSION)"
	@printf "GATEWAY_API_CRDS        = %s\n" "$(GATEWAY_API_CRDS)"

##@ Image build

.PHONY: build
build: ## buildx bake：构建当前主机架构镜像并 load 到本地 docker
	cd "$(REPO_ROOT)" && $(BAKE_ENV_LOCAL) $(BUILDX) bake $(BAKE_OPTS) --pull --load $(BAKE_TARGET)

.PHONY: push
push: _require_registry ## buildx bake：构建并推送到 IMAGE_REGISTRY
	cd "$(REPO_ROOT)" && $(BAKE_ENV_PUSH) $(BUILDX) bake $(BAKE_OPTS) --pull --push $(BAKE_TARGET)

.PHONY: bake-print
bake-print: ## buildx bake --print：打印解析后的构建配置
	cd "$(REPO_ROOT)" && $(BAKE_ENV_PUSH) $(BUILDX) bake $(BAKE_OPTS) --print $(BAKE_TARGET)

.PHONY: bake-check
bake-check: ## buildx bake --check：校验 Dockerfile / build definition
	cd "$(REPO_ROOT)" && $(BAKE_ENV_PUSH) $(BUILDX) bake $(BAKE_OPTS) --check $(BAKE_TARGET)

.PHONY: bake-check-remote
bake-check-remote: ## 在 REMOTE_DOCKER_HOST 跑 buildx bake --check，仅传最小检查上下文
	@set -euo pipefail; \
	archive="$$(mktemp /tmp/code-code-bake-check.XXXXXX.tar.gz)"; \
	trap 'rm -f "$$archive"' EXIT; \
	cd "$(REPO_ROOT)" && COPYFILE_DISABLE=1 $(TAR) --no-xattrs -czf "$$archive" $(BAKE_CHECK_CONTEXT_PATHS); \
	$(SSH) -o BatchMode=yes "$(REMOTE_DOCKER_HOST)" 'rm -f "$(REMOTE_BAKE_ARCHIVE)" "$(REMOTE_BAKE_ARCHIVE).part"; cat > "$(REMOTE_BAKE_ARCHIVE).part"; mv "$(REMOTE_BAKE_ARCHIVE).part" "$(REMOTE_BAKE_ARCHIVE)"' < "$$archive"; \
	$(SSH) -o BatchMode=yes "$(REMOTE_DOCKER_HOST)" 'set -eu; trap '\''rm -rf "$(REMOTE_BAKE_CONTEXT)" "$(REMOTE_BAKE_ARCHIVE)" "$(REMOTE_BAKE_ARCHIVE).part"'\'' EXIT; rm -rf "$(REMOTE_BAKE_CONTEXT)"; mkdir -p "$(REMOTE_BAKE_CONTEXT)"; tar --warning=no-unknown-keyword -xzf "$(REMOTE_BAKE_ARCHIVE)" -C "$(REMOTE_BAKE_CONTEXT)"; cd "$(REMOTE_BAKE_CONTEXT)"; IMAGE_REGISTRY="$(IMAGE_REGISTRY)" IMAGE_TAG="$(IMAGE_TAG)" IMAGE_PLATFORMS="$(REMOTE_BAKE_PLATFORM)" CLAUDE_CODE_CLI_VERSION="$(CLAUDE_CODE_CLI_VERSION)" QWEN_CLI_VERSION="$(QWEN_CLI_VERSION)" GEMINI_CLI_VERSION="$(GEMINI_CLI_VERSION)" make -C deploy bake-check'

##@ Helm

.PHONY: gateway-api-crds-apply
gateway-api-crds-apply: ## Apply Gateway API CRDs with Kubernetes server-side apply
	$(KUBECTL) apply --server-side -f "$(GATEWAY_API_CRDS)"

.PHONY: lint
lint: _require_current_chart_path ## helm lint chart
	$(HELM) lint "$(CHART_DIR_PATH)" -f "$(VALUES_PATH)"

.PHONY: lint-all
lint-all: ## helm lint all charts with their example values
	@set -euo pipefail; \
	for chart in $(DEPLOY_DIR)/charts/*; do \
		[ -d "$$chart" ] || continue; \
		values="$$(find "$$chart/examples" -maxdepth 1 -type f \( -name '*.yaml' -o -name '*.yml' \) 2>/dev/null | sort | head -n 1)"; \
		if [ -n "$$values" ]; then \
			$(HELM) lint "$$chart" -f "$$values"; \
		else \
			$(HELM) lint "$$chart"; \
		fi; \
	done

.PHONY: template
template: _require_current_chart_path ## helm template (静态渲染到 stdout)
	$(HELM) template "$(RELEASE)" "$(CHART_DIR_PATH)" \
		--namespace "$(NAMESPACE)" \
		-f "$(VALUES_PATH)" \
		$(HELM_SET_IMAGE)

.PHONY: template-all
template-all: ## helm template all charts to /tmp for review
	@set -euo pipefail; \
	out_dir="$$(mktemp -d /tmp/code-code-helm-template.XXXXXX)"; \
	for chart in $(DEPLOY_DIR)/charts/*; do \
		[ -d "$$chart" ] || continue; \
		name="$$(basename "$$chart")"; \
		values="$$(find "$$chart/examples" -maxdepth 1 -type f \( -name '*.yaml' -o -name '*.yml' \) 2>/dev/null | sort | head -n 1)"; \
		printf "[template-all] %s\n" "$$name"; \
		if [ -n "$$values" ]; then \
			$(HELM) template "code-code-$$name" "$$chart" -f "$$values" > "$$out_dir/$$name.yaml"; \
		else \
			$(HELM) template "code-code-$$name" "$$chart" > "$$out_dir/$$name.yaml"; \
		fi; \
	done; \
	printf "[template-all] rendered manifests: %s\n" "$$out_dir"

.PHONY: validate
validate: _require_current_chart_path ## helm template + kubeconform 严格校验
	$(HELM) template "$(RELEASE)" "$(CHART_DIR_PATH)" \
		--namespace "$(NAMESPACE)" \
		-f "$(VALUES_PATH)" \
		$(HELM_SET_IMAGE) \
		| $(KUBECONFORM) $(KUBECONFORM_FLAGS) -

.PHONY: validate-all
validate-all: ## helm template all charts + kubeconform
	@set -euo pipefail; \
	for chart in $(DEPLOY_DIR)/charts/*; do \
		[ -d "$$chart" ] || continue; \
		name="$$(basename "$$chart")"; \
		values="$$(find "$$chart/examples" -maxdepth 1 -type f \( -name '*.yaml' -o -name '*.yml' \) 2>/dev/null | sort | head -n 1)"; \
		printf "[validate-all] %s\n" "$$name"; \
		if [ -n "$$values" ]; then \
			$(HELM) template "code-code-$$name" "$$chart" -f "$$values"; \
		else \
			$(HELM) template "code-code-$$name" "$$chart"; \
		fi | $(KUBECONFORM) $(KUBECONFORM_FLAGS) -; \
	done

.PHONY: deploy
deploy: _require_current_chart_path ## helm upgrade --install --atomic --wait（失败自动 rollback）
	$(HELM) upgrade --install "$(RELEASE)" "$(CHART_DIR_PATH)" \
		--namespace "$(NAMESPACE)" \
		--create-namespace \
		--atomic --wait --timeout "$(TIMEOUT)" \
		-f "$(VALUES_PATH)" \
		$(HELM_SET_IMAGE)

.PHONY: kiali-operator-up
kiali-operator-up: ## 安装/更新官方 Kiali Operator（Kiali CR/Route 的前置依赖）
	$(HELM) upgrade --install "$(KIALI_OPERATOR_RELEASE)" "$(KIALI_OPERATOR_CHART)" \
		$(KIALI_OPERATOR_VERSION_ARG) \
		--namespace "$(KIALI_OPERATOR_NAMESPACE)" \
		--create-namespace \
		--set image.repo='$(KIALI_OPERATOR_IMAGE_REPO)' \
		--set image.tag='$(KIALI_OPERATOR_IMAGE_TAG)' \
		--set image.pullPolicy='$(KIALI_OPERATOR_IMAGE_PULL_POLICY)' \
		--set cr.create=false \
		--set allowAdHocKialiImage=true \
		--set securityContext.runAsNonRoot=true \
		--set securityContext.allowPrivilegeEscalation=false \
		--set 'securityContext.capabilities.drop[0]=ALL' \
		--set securityContext.seccompProfile.type=RuntimeDefault \
		--wait --timeout "$(KIALI_OPERATOR_TIMEOUT)" \
		$(KIALI_OPERATOR_HELM_ARGS)

.PHONY: infrastructure-addons-up
infrastructure-addons-up: kiali-operator-up ## 安装/更新 observability addons；启用 Kiali 时自动先装官方 Kiali Operator
	$(HELM) upgrade --install "$(INFRASTRUCTURE_ADDONS_RELEASE)" "$(INFRASTRUCTURE_ADDONS_CHART)" \
		--namespace "$(INFRASTRUCTURE_ADDONS_NAMESPACE)" \
		--create-namespace \
		--atomic --wait --timeout "$(INFRASTRUCTURE_ADDONS_TIMEOUT)" \
		-f "$(INFRASTRUCTURE_ADDONS_VALUES)" \
		$(INFRASTRUCTURE_ADDONS_HELM_ARGS)

.PHONY: test
test: ## helm test（chart 内置连通性 smoke test）
	$(HELM) test "$(RELEASE)" --namespace "$(NAMESPACE)" --logs

.PHONY: smoke-ingress
smoke-ingress: ## 验证平台入口 URL、HTTPRoute 条件和 Kiali config validation
	CURL="$(CURL)" JQ="$(JQ)" KUBECTL="$(KUBECTL)" ISTIOCTL="$(ISTIOCTL)" \
	CONSOLE_ROUTE_NAMESPACE="$(CONSOLE_ROUTE_NAMESPACE)" \
	SHOWCASE_ROUTE_NAMESPACE="$(SHOWCASE_ROUTE_NAMESPACE)" \
	OBSERVABILITY_ROUTE_NAMESPACE="$(OBSERVABILITY_ROUTE_NAMESPACE)" \
	PLATFORM_GATEWAY_NAMESPACE="$(PLATFORM_GATEWAY_NAMESPACE)" \
	PLATFORM_GATEWAY_NAME="$(PLATFORM_GATEWAY_NAME)" \
	CONSOLE_URL="$(CONSOLE_URL)" \
	SHOWCASE_URL="$(SHOWCASE_URL)" \
	GRAFANA_URL="$(GRAFANA_URL)" \
	KIALI_URL="$(KIALI_URL)" \
	KIALI_BASE_URL="$(KIALI_BASE_URL)" \
	ANALYZE_NAMESPACES="$(ANALYZE_NAMESPACES)" \
	"$(DEPLOY_DIR)/scripts/ingress-smoke.sh"

.PHONY: smoke-egress
smoke-egress: smoke-egress-control-plane smoke-egress-l4 smoke-egress-l7-header ## 验证 egress access-set 生命周期、L4 direct/proxy、L7 header rewrite

.PHONY: smoke-egress-control-plane
smoke-egress-control-plane: ## 验证 egress access-set 生命周期
	"$(DEPLOY_DIR)/scripts/egress-access-set-smoke.sh"

.PHONY: smoke-egress-l4
smoke-egress-l4: ## 验证 egress L4 direct TLS 和 preset proxy TCP
	PLATFORM_EGRESS_SMOKE_CHECKS=l4,proxy "$(DEPLOY_DIR)/scripts/egress-data-plane-smoke.sh"

.PHONY: smoke-egress-l7-header
smoke-egress-l7-header: ## 验证 egress L7 request/response header modifier
	PLATFORM_EGRESS_SMOKE_CHECKS=l7-header "$(DEPLOY_DIR)/scripts/egress-data-plane-smoke.sh"

.PHONY: smoke-egress-l7-telemetry
smoke-egress-l7-telemetry: ## 验证 egress L7 Telemetry/OTel/Prometheus header metrics
	PLATFORM_EGRESS_SMOKE_CHECKS=l7-header,l7-telemetry "$(DEPLOY_DIR)/scripts/egress-data-plane-smoke.sh"

.PHONY: smoke-egress-l7-dynamic-authz
smoke-egress-l7-dynamic-authz: ## 验证 egress L7 CUSTOM ext_authz provider 接入
	PLATFORM_EGRESS_SMOKE_ACCESS_SET_ID=support.external-rule-set.l7-dynamic-authz-smoke PLATFORM_EGRESS_SMOKE_CHECKS=l7-request-header,dynamic-authz "$(DEPLOY_DIR)/scripts/egress-data-plane-smoke.sh"

.PHONY: smoke-egress-full
smoke-egress-full: smoke-egress smoke-egress-l7-telemetry smoke-egress-l7-dynamic-authz ## 运行完整 egress smoke，包括 telemetry 和 dynamic ext_authz

.PHONY: status
status: ## helm status + kubectl get
	$(HELM) status "$(RELEASE)" --namespace "$(NAMESPACE)" || true
	$(KUBECTL) -n "$(NAMESPACE)" get deploy,svc,httproute

.PHONY: rollback
rollback: ## helm rollback 到上一个 revision
	$(HELM) rollback "$(RELEASE)" 0 --namespace "$(NAMESPACE)"

.PHONY: uninstall
uninstall: ## helm uninstall release
	$(HELM) uninstall "$(RELEASE)" --namespace "$(NAMESPACE)"

.PHONY: diff
diff: _require_current_chart_path ## helm diff upgrade（需要 helm-diff 插件）
	$(HELM) diff upgrade "$(RELEASE)" "$(CHART_DIR_PATH)" \
		--namespace "$(NAMESPACE)" \
		-f "$(VALUES_PATH)" \
		$(HELM_SET_IMAGE) \
		--allow-unreleased

##@ Self-hosted registry (单机/内网部署用)

.PHONY: registry-up
registry-up: ## 在 $(REGISTRY_NAMESPACE) 启动 docker registry:2 + 上游 cache (NodePort 30500/30502/30503/30504)
	$(HELM) upgrade --install "$(REGISTRY_RELEASE)" "$(REGISTRY_CHART)" \
		--namespace "$(REGISTRY_NAMESPACE)" \
		--create-namespace \
		--atomic --wait --timeout 3m \
		$(REGISTRY_HELM_ARGS)

.PHONY: registry-down
registry-down: ## 卸载本地 registry
	$(HELM) uninstall "$(REGISTRY_RELEASE)" --namespace "$(REGISTRY_NAMESPACE)"

.PHONY: registry-status
registry-status: ## 查看 registry 状态 + NodePort
	$(KUBECTL) -n "$(REGISTRY_NAMESPACE)" get deploy,svc -l "app.kubernetes.io/instance=$(REGISTRY_RELEASE)"

##@ Maintenance

.PHONY: docs
docs: ## helm-docs：重新生成各 chart 的 README values 表
	$(HELM_DOCS) \
		--chart-search-root "$(DEPLOY_DIR)/charts" \
		--template-files "$(DEPLOY_DIR)/charts/README.md.gotmpl" \
		--ignore-non-descriptions \
		--sort-values-order file

.PHONY: scripts-check
scripts-check: ## bash -n scripts；如果存在 shellcheck，也运行 shellcheck
	@set -euo pipefail; \
	for script in $(DEPLOY_DIR)/scripts/*.sh; do \
		printf "[scripts-check] bash -n %s\n" "$$(basename "$$script")"; \
		bash -n "$$script"; \
	done; \
	if command -v "$(SHELLCHECK)" >/dev/null 2>&1; then \
		"$(SHELLCHECK)" $(DEPLOY_DIR)/scripts/*.sh; \
	else \
		printf "[scripts-check] shellcheck not found; skipped\n"; \
	fi

.PHONY: package-all
package-all: ## helm package all charts into deploy/tmp/charts
	rm -rf "$(DEPLOY_DIR)/tmp/charts"
	mkdir -p "$(DEPLOY_DIR)/tmp/charts"
	@set -euo pipefail; \
	for chart in $(DEPLOY_DIR)/charts/*; do \
		[ -d "$$chart" ] || continue; \
		$(HELM) package "$$chart" --destination "$(DEPLOY_DIR)/tmp/charts"; \
	done

.PHONY: clean
clean: ## 清理本地临时产物（.release-tmp.*、tmp/）
	rm -rf "$(DEPLOY_DIR)"/.release-tmp.* "$(DEPLOY_DIR)/tmp"

# --- Internal guards ---

.PHONY: _require_registry
_require_registry:
	@if [ -z "$(IMAGE_REGISTRY)" ]; then \
		echo "ERROR: IMAGE_REGISTRY is required for this target."; \
		echo "Hint: export IMAGE_REGISTRY=192.168.0.126:30500/  (trailing slash optional)"; \
		exit 1; \
	fi

.PHONY: _require_current_chart_path
_require_current_chart_path:
	@case "$(abspath $(CHART_DIR_PATH))" in \
		$(DEPLOY_DIR)/charts/*) ;; \
		*) \
			echo "ERROR: CHART_DIR must point under $(DEPLOY_DIR)/charts."; \
			echo "Current CHART_DIR: $(CHART_DIR_PATH)"; \
			exit 1; \
			;; \
	esac
	@if [ -d "$(REPO_ROOT)/deploy/k8s/charts" ]; then \
		echo "ERROR: legacy deploy/k8s/charts exists; use deploy/charts only."; \
		exit 1; \
	fi
