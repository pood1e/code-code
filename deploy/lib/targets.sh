#!/usr/bin/env bash
# Build target groups.

readonly APP_TARGETS=(
  platform-auth-service
  platform-model-service
  platform-provider-service
  platform-network-service
  platform-profile-service
  platform-support-service
  platform-cli-runtime-service
  platform-agent-runtime-service
  notification-dispatcher
  wecom-callback-adapter
  platform-chat-service
  console-api
  console-web
)

readonly WASM_TARGETS=(
  agent-runtime-egress-auth-wasm
  control-plane-egress-auth-wasm
)

readonly GO_TARGETS=(
  platform-auth-service
  platform-model-service
  platform-provider-service
  platform-network-service
  platform-profile-service
  platform-support-service
  platform-cli-runtime-service
  platform-agent-runtime-service
  notification-dispatcher
  wecom-callback-adapter
  platform-chat-service
  console-api
)

readonly RUNTIME_TARGETS=(
  claude-code-agent
  agent-cli-qwen
  agent-cli-gemini
  cli-output-sidecar
)

readonly ALL_TARGETS=(
  "${APP_TARGETS[@]}"
  "${WASM_TARGETS[@]}"
  "${RUNTIME_TARGETS[@]}"
)
