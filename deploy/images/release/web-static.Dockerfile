# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:24-bookworm AS build

ARG BUILD_NPM_REGISTRY
ARG COREPACK_NPM_REGISTRY
ARG WEB_FILTER

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:${PATH} \
    NPM_CONFIG_REGISTRY="${BUILD_NPM_REGISTRY}" \
    npm_config_registry="${BUILD_NPM_REGISTRY}" \
    COREPACK_NPM_REGISTRY="${COREPACK_NPM_REGISTRY}" \
    HOME=/workspace

WORKDIR /workspace/packages/console-web

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

RUN test -n "${WEB_FILTER}"

COPY packages/console-web/.npmrc /workspace/packages/console-web/.npmrc
COPY packages/console-web/package.json /workspace/packages/console-web/package.json
COPY packages/console-web/pnpm-lock.yaml /workspace/packages/console-web/pnpm-lock.yaml
COPY packages/console-web/pnpm-workspace.yaml /workspace/packages/console-web/pnpm-workspace.yaml
COPY packages/console-web/app/package.json /workspace/packages/console-web/app/package.json
COPY packages/console-web/showcase/package.json /workspace/packages/console-web/showcase/package.json
COPY packages/console-web/packages/agentprofile/package.json /workspace/packages/console-web/packages/agentprofile/package.json
COPY packages/console-web/packages/chat/package.json /workspace/packages/console-web/packages/chat/package.json
COPY packages/console-web/packages/credential/package.json /workspace/packages/console-web/packages/credential/package.json
COPY packages/console-web/packages/provider/package.json /workspace/packages/console-web/packages/provider/package.json
COPY packages/console-web/packages/overview/package.json /workspace/packages/console-web/packages/overview/package.json
COPY packages/console-web/packages/ui/package.json /workspace/packages/console-web/packages/ui/package.json
COPY packages/agent-contract/package.json /workspace/packages/agent-contract/package.json

RUN --mount=type=cache,target=/pnpm/store,id=code-code-web-static-pnpm-store,sharing=locked \
    pnpm fetch --store-dir /pnpm/store --frozen-lockfile

COPY packages/agent-contract /workspace/packages/agent-contract
COPY packages/console-web /workspace/packages/console-web

RUN --mount=type=cache,target=/pnpm/store,id=code-code-web-static-pnpm-store,sharing=locked \
    pnpm install --store-dir /pnpm/store --frozen-lockfile --offline

RUN pnpm --filter "${WEB_FILTER}" build

FROM nginxinc/nginx-unprivileged:1.29-alpine

ARG WEB_DIST
ARG NGINX_CONFIG

RUN test -n "${WEB_DIST}" && test -n "${NGINX_CONFIG}"

COPY deploy/images/${NGINX_CONFIG} /etc/nginx/nginx.conf.template
COPY deploy/images/console-web.entrypoint.sh /entrypoint.sh
COPY --chown=101:101 --from=build /workspace/packages/console-web/${WEB_DIST} /usr/share/nginx/html

USER 101:101

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
