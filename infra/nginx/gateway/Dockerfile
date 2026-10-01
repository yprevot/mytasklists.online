# Gateway de producción (Coolify). Se construye desde la raíz del monorepo:
#   docker build -f infra/nginx/gateway/Dockerfile --build-arg RELEASE_SHA=<sha> .
# La configuración va dentro de la imagen: el VPS solo descarga y arranca, sin
# montar archivos del repositorio.
FROM nginx:1.30-alpine

ARG RELEASE_SHA=dev
ENV RELEASE_SHA=${RELEASE_SHA} \
    # El entrypoint de nginx solo sustituye estas variables en la plantilla
    NGINX_ENVSUBST_FILTER='^(TRUSTED_PROXY_CIDR|RELEASE_SHA)$'

COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/snippets/ /etc/nginx/snippets/
COPY infra/nginx/gateway/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 infra/nginx/gateway/15-well-known.sh /docker-entrypoint.d/15-well-known.sh

EXPOSE 80
