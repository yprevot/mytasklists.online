# Se construye desde la raíz del monorepo (context: .) para instalar con
# `npm ci` a partir del package-lock.json común: builds reproducibles.

# ─────────────── Etapa 1: manifiestos del workspace ───────────────
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json   apps/backend/
COPY apps/frontend/package.json  apps/frontend/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/landing/package.json   apps/landing/
COPY e2e/package.json            e2e/
COPY packages/contracts           packages/contracts/

# ─────────────── Etapa 2: dependencias + compilación ───────────────
FROM manifests AS builder
# KEEP_SEED=true (desarrollo y e2e) conserva los datos de demostración; las
# imágenes de producción se construyen con KEEP_SEED=false (ver deploy.yml).
ARG KEEP_SEED=true
RUN npm ci --workspace @lista/backend --no-audit --no-fund
COPY apps/backend/tsconfig.json apps/backend/nest-cli.json apps/backend/
COPY apps/backend/src apps/backend/src
RUN npm run build --workspace @lista/backend \
 && find apps/backend/dist -name '*.map' -delete \
 && if [ "$KEEP_SEED" != "true" ]; then rm -rf apps/backend/dist/database/seeds; fi

# ─────────────── Etapa 3: dependencias de producción ───────────────
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
