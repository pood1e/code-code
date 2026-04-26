# Local-only web packaging. The build context is the prebuilt dist directory.

FROM nginxinc/nginx-unprivileged@sha256:5f03fade1e2a93aca8912dff133d89ff4c363f45c16972aa28a5cb7144fed1b0

COPY --from=image-config console-web.nginx.conf /etc/nginx/nginx.conf.template
COPY --from=image-config console-web.entrypoint.sh /entrypoint.sh
COPY --chown=101:101 . /usr/share/nginx/html

USER 101:101

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
