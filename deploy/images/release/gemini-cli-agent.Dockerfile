# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ARG NPM_CONFIG_REGISTRY
ARG CLI_VERSION=latest

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}

RUN mkdir -p /etc/ssl/certs

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install -g @google/gemini-cli@${CLI_VERSION}

WORKDIR /workspace
RUN chown -R node:node /workspace

COPY deploy/agents/gemini-cli/entrypoint.sh /usr/local/bin/gemini-entrypoint.sh
COPY deploy/agents/gemini-cli/entrypoint.sh /usr/local/bin/agent-entrypoint.sh
COPY deploy/agents/gemini-cli/prepare.sh /usr/local/bin/agent-prepare.sh
COPY deploy/agents/gemini-cli/configure-gemini.js /usr/local/lib/gemini-cli/configure-gemini.js
COPY deploy/agents/common/cli-output-runtime.sh /usr/local/bin/cli-output-runtime.sh
RUN chmod +x /usr/local/bin/gemini-entrypoint.sh \
             /usr/local/bin/agent-entrypoint.sh \
             /usr/local/bin/agent-prepare.sh \
             /usr/local/bin/cli-output-runtime.sh

USER node

ENTRYPOINT ["/usr/local/bin/gemini-entrypoint.sh"]
