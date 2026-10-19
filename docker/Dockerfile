# syntax=docker/dockerfile:1.6

# Built with the repository root as the context, which docker-compose.yml at the
# root sets up: `docker compose up -d --build`, or by hand,
# `docker build -f docker/Dockerfile .`. What the context leaves out is in
# Dockerfile.dockerignore beside this file, which BuildKit (Docker's default
# builder since Engine 23) reads in place of a root .dockerignore.

# ── Stage 1: Build the static site ───────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Serve the built assets with nginx ──────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

# Exec form, as hadolint's DL3025 asks. The `|| exit 1` still needs a shell:
# Docker reads exit code 1 as unhealthy, while wget reports some failures
# with other codes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]

CMD ["nginx", "-g", "daemon off;"]
