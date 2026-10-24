# syntax=docker/dockerfile:1.7
# Image produksi frontend FlowerBloom: build Vite lalu disajikan Nginx non-root (port 8080).

FROM node:25-alpine AS bangun
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS jalan
LABEL org.opencontainers.image.title="flowerbloom-frontend" \
      org.opencontainers.image.description="PWA FlowerBloom (React + Vite) disajikan Nginx" \
      org.opencontainers.image.source="https://github.com/Risaru9/flowerbloom"
ENV API_UPSTREAM=http://api:8000
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=bangun /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/sehat >/dev/null || exit 1
