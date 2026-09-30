# Se construye desde la raiz del monorepo (context: .) con `npm ci` y el
# package-lock.json comun.

# ─────────────── Etapa 1: compilacion del bundle ───────────────
FROM node:24-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ARG VITE_GOOGLE_ENABLED=true
ARG VITE_APPLE_ENABLED=true
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_GOOGLE_ENABLED=$VITE_GOOGLE_ENABLED \
    VITE_APPLE_ENABLED=$VITE_APPLE_ENABLED

COPY package.json package-lock.json ./
COPY apps/backend/package.json   apps/backend/
COPY apps/frontend/package.json  apps/frontend/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/landing/package.json   apps/landing/
COPY e2e/package.json            e2e/
COPY packages/contracts           packages/contracts/
RUN npm ci --workspace @lista/frontend --no-audit --no-fund

COPY apps/frontend/tsconfig.json apps/frontend/vite.config.ts apps/frontend/vite-env.d.ts apps/frontend/index.html apps/frontend/
COPY apps/frontend/public apps/frontend/public
COPY apps/frontend/src apps/frontend/src
RUN npm run build --workspace @lista/frontend

# ─────────────── Etapa 2: servidor estatico ───────────────
FROM nginx:1.30-alpine AS runtime
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html/app
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/app/ || exit 1
