# ─────────────── Etapa 1: compilacion del bundle ───────────────
FROM node:22-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ARG VITE_GOOGLE_ENABLED=true
ARG VITE_APPLE_ENABLED=true
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_GOOGLE_ENABLED=$VITE_GOOGLE_ENABLED \
    VITE_APPLE_ENABLED=$VITE_APPLE_ENABLED

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json vite.config.ts vite-env.d.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ─────────────── Etapa 2: servidor estatico ───────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/app/ || exit 1
