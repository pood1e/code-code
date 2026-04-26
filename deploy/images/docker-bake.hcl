variable "BUILD_HTTP_PROXY" {
  default = ""
}

variable "BUILD_HTTPS_PROXY" {
  default = ""
}

variable "BUILD_NO_PROXY" {
  default = ""
}

variable "BUILD_NPM_REGISTRY" {
  default = ""
}

variable "BUILD_GOPROXY" {
  default = ""
}

variable "BUILD_PIP_INDEX_URL" {
  default = ""
}

variable "BUILD_DEBIAN_MIRROR" {
  default = ""
}

variable "IMAGE_REGISTRY" {
  default = ""
}

variable "WASM_IMAGE_PUSH_REGISTRY" {
  default = ""
}

variable "IMAGE_TAG" {
  default = "0.0.0"
}

# Build proxy and package mirror args shared by all targets.
target "_proxyable" {
  args = {
    HTTP_PROXY          = "${BUILD_HTTP_PROXY}"
    HTTPS_PROXY         = "${BUILD_HTTPS_PROXY}"
    NO_PROXY            = "${BUILD_NO_PROXY}"
    BUILD_NPM_REGISTRY  = "${BUILD_NPM_REGISTRY}"
    NPM_CONFIG_REGISTRY = "${BUILD_NPM_REGISTRY}"
    COREPACK_NPM_REGISTRY = "${BUILD_NPM_REGISTRY}"
    GOPROXY             = "${BUILD_GOPROXY}"
    PIP_INDEX_URL       = "${BUILD_PIP_INDEX_URL}"
    DEBIAN_MIRROR       = "${BUILD_DEBIAN_MIRROR}"
  }
}

group "default" {
  targets = ["platform-auth-service", "platform-model-service", "platform-provider-service", "platform-network-service", "platform-profile-service", "platform-support-service", "platform-cli-runtime-service", "platform-agent-runtime-service", "notification-dispatcher", "wecom-callback-adapter", "platform-chat-service", "console-api", "console-web", "agent-runtime-egress-auth-wasm", "control-plane-egress-auth-wasm"]
}

group "runtime" {
  targets = ["claude-code-agent", "agent-cli-qwen", "agent-cli-gemini", "cli-output-sidecar"]
}

group "all" {
  targets = ["platform-auth-service", "platform-model-service", "platform-provider-service", "platform-network-service", "platform-profile-service", "platform-support-service", "platform-cli-runtime-service", "platform-agent-runtime-service", "notification-dispatcher", "wecom-callback-adapter", "platform-chat-service", "console-api", "console-web", "agent-runtime-egress-auth-wasm", "control-plane-egress-auth-wasm", "claude-code-agent", "agent-cli-qwen", "agent-cli-gemini", "cli-output-sidecar"]
}

# --- Go platform services (shared Dockerfile, parameterized by SERVICE_NAME) ---

target "_go_platform_service" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/go-service.Dockerfile"
  args       = { SERVICE_MODULE = "packages/platform-k8s" }
}

target "_go_console_service" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/go-service.Dockerfile"
  args       = { SERVICE_MODULE = "packages/console-api" }
}

target "platform-auth-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-auth-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-auth-service:${IMAGE_TAG}"]
}

target "platform-model-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-model-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-model-service:${IMAGE_TAG}"]
}

target "platform-provider-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-provider-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-provider-service:${IMAGE_TAG}"]
}

target "platform-network-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-network-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-network-service:${IMAGE_TAG}"]
}

target "platform-profile-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-profile-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-profile-service:${IMAGE_TAG}"]
}

target "platform-support-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-support-service", EXPOSE_PORT = "8080" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-support-service:${IMAGE_TAG}"]
}

target "platform-cli-runtime-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-cli-runtime-service", EXPOSE_PORT = "8080" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-cli-runtime-service:${IMAGE_TAG}"]
}

target "platform-agent-runtime-service" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "platform-agent-runtime-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-agent-runtime-service:${IMAGE_TAG}"]
}

target "notification-dispatcher" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "notification-dispatcher", EXPOSE_PORT = "8080" }
  tags       = ["${IMAGE_REGISTRY}code-code/notification-dispatcher:${IMAGE_TAG}"]
}

target "wecom-callback-adapter" {
  inherits   = ["_go_platform_service"]
  args       = { SERVICE_NAME = "wecom-callback-adapter", EXPOSE_PORT = "8080" }
  tags       = ["${IMAGE_REGISTRY}code-code/wecom-callback-adapter:${IMAGE_TAG}"]
}

# --- Console ---

target "platform-chat-service" {
  inherits   = ["_go_console_service"]
  args       = { SERVICE_NAME = "platform-chat-service" }
  tags       = ["${IMAGE_REGISTRY}code-code/platform-chat-service:${IMAGE_TAG}"]
}

target "console-api" {
  inherits   = ["_go_console_service"]
  args       = { SERVICE_MODULE = "packages/console-api", SERVICE_NAME = "console-api", EXPOSE_PORT = "8080" }
  tags       = ["${IMAGE_REGISTRY}code-code/console-api:${IMAGE_TAG}"]
}

target "console-web" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/console-web.Dockerfile"
  tags       = ["${IMAGE_REGISTRY}code-code/console-web:${IMAGE_TAG}"]
}

target "agent-runtime-egress-auth-wasm" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/egress-auth-wasm.Dockerfile"
  platforms  = ["linux/amd64"]
  args = {
    WASM_PACKAGE_DIR     = "packages/platform-k8s/egress-auth-wasm"
    WASM_ARTIFACT_NAME   = "egress_auth_wasm"
    WASM_TARGET_CACHE_ID = "code-code-agent-runtime-egress-auth-wasm-target"
  }
  tags       = ["${WASM_IMAGE_PUSH_REGISTRY}code-code/agent-runtime-egress-auth-wasm:${IMAGE_TAG}"]
}

target "control-plane-egress-auth-wasm" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/egress-auth-wasm.Dockerfile"
  platforms  = ["linux/amd64"]
  args = {
    WASM_PACKAGE_DIR     = "packages/platform-k8s/control-plane-egress-auth-wasm"
    WASM_ARTIFACT_NAME   = "control_plane_egress_auth_wasm"
    WASM_TARGET_CACHE_ID = "code-code-control-plane-egress-auth-wasm-target"
  }
  tags       = ["${WASM_IMAGE_PUSH_REGISTRY}code-code/control-plane-egress-auth-wasm:${IMAGE_TAG}"]
}

# --- Agent runtimes ---

target "claude-code-agent" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/claude-code-agent.Dockerfile"
  tags       = ["${IMAGE_REGISTRY}code-code/claude-code-agent:${IMAGE_TAG}"]
}

target "agent-cli-qwen" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/qwen-cli-agent.Dockerfile"
  tags       = ["${IMAGE_REGISTRY}code-code/agent-cli-qwen:${IMAGE_TAG}"]
}

target "agent-cli-gemini" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/gemini-cli-agent.Dockerfile"
  tags       = ["${IMAGE_REGISTRY}code-code/agent-cli-gemini:${IMAGE_TAG}"]
}

# --- Sidecars ---

target "cli-output-sidecar" {
  inherits   = ["_proxyable"]
  context    = "."
  dockerfile = "deploy/images/release/cli-output-sidecar.Dockerfile"
  tags       = ["${IMAGE_REGISTRY}code-code/cli-output-sidecar:${IMAGE_TAG}"]
}
