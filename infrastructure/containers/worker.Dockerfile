FROM node:24-bookworm-slim AS package-manager

ENV PNPM_HOME=/opt/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV HUSKY=0
ENV SCARF_ANALYTICS=false

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@12.17.0 \
    && pnpm config set store-dir /opt/pnpm/store

WORKDIR /app

FROM package-manager AS development-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile

FROM development-dependencies AS build

COPY tsconfig.json tsconfig.server.json prisma7.config.ts ./
COPY apps/api apps/api
COPY apps/worker apps/worker
COPY prisma prisma
COPY src src

RUN DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma pnpm prisma:generate \
    && pnpm build:server

FROM package-manager AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        openssl \
        poppler-utils \
        qpdf \
        webp \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node

CMD ["node", "dist/apps/worker/src/main.js"]
