# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim

ARG NPM_CONFIG_REGISTRY
ARG CLI_PACKAGE
ARG CLI_VERSION
ARG AGENT_DIR

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    test -n "${CLI_PACKAGE}" && test -n "${CLI_VERSION}" && test -n "${AGENT_DIR}"; \
    if [ -n "${NPM_CONFIG_REGISTRY}" ]; then npm config set registry "${NPM_CONFIG_REGISTRY}"; fi; \
    npm install -g "${CLI_PACKAGE}@${CLI_VERSION}"

WORKDIR /workspace

COPY deploy/agents/common /usr/local/lib/code-code-agent/common
COPY deploy/agents/${AGENT_DIR} /usr/local/lib/${AGENT_DIR}

RUN install -m 0755 /usr/local/lib/${AGENT_DIR}/entrypoint.sh /usr/local/bin/agent-entrypoint.sh \
    && install -m 0755 /usr/local/lib/${AGENT_DIR}/prepare.sh /usr/local/bin/agent-prepare.sh \
    && install -m 0755 /usr/local/lib/code-code-agent/common/cli-output-runtime.sh /usr/local/bin/cli-output-runtime.sh \
    && install -m 0755 /usr/local/lib/code-code-agent/common/auth-helper.sh /usr/local/bin/claude-auth-helper.sh \
    && chown -R node:node /workspace

USER node

ENTRYPOINT ["/usr/local/bin/agent-entrypoint.sh"]
