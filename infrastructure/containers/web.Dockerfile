FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/opt/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV HUSKY=0
ENV SCARF_ANALYTICS=false

RUN npm install --global pnpm@12.17.0 \
    && pnpm config set store-dir /opt/pnpm/store

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

RUN pnpm --dir apps/web build

FROM caddy:2.10.2-alpine AS runtime

RUN apk add --no-cache libcap-setcap \
    && setcap -r /usr/bin/caddy \
    && apk del libcap-setcap \
    && addgroup -S caddy \
    && adduser -S -D -H -s /sbin/nologin -G caddy caddy \
    && mkdir -p /srv /data /config \
    && chown -R caddy:caddy /srv /data /config /etc/caddy

COPY --chown=caddy:caddy infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=caddy:caddy /app/apps/web/dist /srv

USER caddy

EXPOSE 8080 8443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --output-document=/dev/null http://127.0.0.1:2019/config/ || exit 1
