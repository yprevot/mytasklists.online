FROM node:24-alpine AS builder
WORKDIR /app

ARG LANDING_IOS_URL=#descargar
ARG LANDING_ANDROID_URL=#descargar
ARG LANDING_APP_URL=/app/
ENV LANDING_IOS_URL=$LANDING_IOS_URL \
    LANDING_ANDROID_URL=$LANDING_ANDROID_URL \
    LANDING_APP_URL=$LANDING_APP_URL

COPY package.json build.mjs ./
COPY src ./src
RUN node build.mjs

FROM nginx:1.30-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ || exit 1
