# Se construye desde la raíz del monorepo (context: .) con `npm ci` y el
# package-lock.json común.
FROM node:24-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
COPY apps/backend/package.json   apps/backend/
COPY apps/frontend/package.json  apps/frontend/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/landing/package.json   apps/landing/
COPY e2e/package.json            e2e/
COPY packages/contracts           packages/contracts/
RUN npm ci --workspace @lista/dashboard --no-audit --no-fund

COPY apps/dashboard/tsconfig.json apps/dashboard/vite.config.ts apps/dashboard/vite-env.d.ts apps/dashboard/index.html apps/dashboard/
COPY apps/dashboard/public apps/dashboard/public
COPY apps/dashboard/src apps/dashboard/src
RUN npm run build --workspace @lista/dashboard

FROM nginx:1.30-alpine AS runtime
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html/dashboard
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/dashboard/ || exit 1
