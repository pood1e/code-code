# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ARG NPM_CONFIG_REGISTRY
ARG CLI_VERSION=latest

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}

RUN mkdir -p /etc/ssl/certs

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install -g @qwen-code/qwen-code@${CLI_VERSION}

WORKDIR /workspace
RUN chown -R node:node /workspace

COPY deploy/agents/qwen-cli/entrypoint.sh /usr/local/bin/qwen-entrypoint.sh
COPY deploy/agents/qwen-cli/entrypoint.sh /usr/local/bin/agent-entrypoint.sh
COPY deploy/agents/qwen-cli/prepare.sh /usr/local/bin/agent-prepare.sh
COPY deploy/agents/qwen-cli/configure-qwen.js /usr/local/lib/qwen-cli/configure-qwen.js
COPY deploy/agents/common/cli-output-runtime.sh /usr/local/bin/cli-output-runtime.sh
RUN chmod +x /usr/local/bin/qwen-entrypoint.sh \
             /usr/local/bin/agent-entrypoint.sh \
             /usr/local/bin/agent-prepare.sh \
             /usr/local/bin/cli-output-runtime.sh

USER node

ENTRYPOINT ["/usr/local/bin/qwen-entrypoint.sh"]
