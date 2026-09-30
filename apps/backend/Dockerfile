# Se construye desde la raiz del monorepo (context: .) para instalar con
# `npm ci` a partir del package-lock.json comun: builds reproducibles.

# ─────────────── Etapa 1: manifiestos del workspace ───────────────
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json   apps/backend/
COPY apps/frontend/package.json  apps/frontend/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/landing/package.json   apps/landing/
COPY e2e/package.json            e2e/

# ─────────────── Etapa 2: dependencias + compilacion ───────────────
FROM manifests AS builder
RUN npm ci --workspace @lista/backend --no-audit --no-fund
COPY apps/backend/tsconfig.json apps/backend/nest-cli.json apps/backend/
COPY apps/backend/src apps/backend/src
RUN npm run build --workspace @lista/backend

# ─────────────── Etapa 3: dependencias de produccion ───────────────
FROM manifests AS deps
RUN npm ci --workspace @lista/backend --omit=dev --no-audit --no-fund \
 && mkdir -p apps/backend/node_modules \
 && npm cache clean --force

# ────────────────────── Etapa 4: imagen final ──────────────────────
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend

RUN apk add --no-cache tini \
 && addgroup -S nodejs -g 1001 \
 && adduser  -S nestjs -u 1001 -G nodejs

COPY --from=deps    /app/node_modules                 /app/node_modules
COPY --from=deps    /app/apps/backend/node_modules    ./node_modules
COPY --from=builder /app/apps/backend/dist            ./dist
COPY apps/backend/package.json ./

USER nestjs
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
