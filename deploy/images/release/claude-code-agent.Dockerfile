# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ARG NPM_CONFIG_REGISTRY
ARG CLI_VERSION=latest

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}

RUN mkdir -p /etc/ssl/certs

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install -g @anthropic-ai/claude-code@${CLI_VERSION}

WORKDIR /workspace
RUN chown -R node:node /workspace

COPY deploy/agents/claude-code/entrypoint.sh /usr/local/bin/claude-entrypoint.sh
COPY deploy/agents/claude-code/entrypoint.sh /usr/local/bin/agent-entrypoint.sh
COPY deploy/agents/claude-code/prepare.sh /usr/local/bin/agent-prepare.sh
COPY deploy/agents/common/auth-helper.sh /usr/local/bin/claude-auth-helper.sh
COPY deploy/agents/common/cli-output-runtime.sh /usr/local/bin/cli-output-runtime.sh
RUN chmod +x /usr/local/bin/claude-entrypoint.sh \
             /usr/local/bin/agent-entrypoint.sh \
             /usr/local/bin/agent-prepare.sh \
             /usr/local/bin/claude-auth-helper.sh \
             /usr/local/bin/cli-output-runtime.sh

USER node

ENTRYPOINT ["/usr/local/bin/claude-entrypoint.sh"]
