# =============================================================================
# Shared base: Node.js + Bun for package management
# =============================================================================
FROM node:24 AS base-builder

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN bun install

# =============================================================================
# Server
# =============================================================================
FROM base-builder AS server-builder
RUN bun run --filter server build

FROM node:24 AS server
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY apps/server ./apps/server

COPY --from=server-builder /app/apps/server/dist ./apps/server/dist
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/apps/server/node_modules ./apps/server/node_modules

RUN npm install -g pm2

COPY apps/server/ecosystem.config.cjs ./ecosystem.config.cjs

ENV NODE_ENV=production
EXPOSE 3001

CMD ["dumb-init", "pm2-runtime", "start", "ecosystem.config.cjs"]

# =============================================================================
# Web
# =============================================================================
FROM base-builder AS web-builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN bun run --filter web build

FROM node:24 AS web
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY apps/web ./apps/web

COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/apps/web/node_modules ./apps/web/node_modules

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["dumb-init", "node", "node_modules/next/dist/bin/next", "start"]

# =============================================================================
# Admin (Vite static SPA)
# =============================================================================
FROM base-builder AS admin-builder
ARG VITE_API_URL
ARG VITE_DD_RUM_APPLICATION_ID
ARG VITE_DD_CLIENT_TOKEN
ARG VITE_DD_RUM_PROXY_URL
ARG VITE_DD_ENV
ARG VITE_DD_SITE
ARG VITE_APP_VERSION
ENV VITE_API_URL=$VITE_API_URL \
    VITE_DD_RUM_APPLICATION_ID=$VITE_DD_RUM_APPLICATION_ID \
    VITE_DD_CLIENT_TOKEN=$VITE_DD_CLIENT_TOKEN \
    VITE_DD_RUM_PROXY_URL=$VITE_DD_RUM_PROXY_URL \
    VITE_DD_ENV=$VITE_DD_ENV \
    VITE_DD_SITE=$VITE_DD_SITE \
    VITE_APP_VERSION=$VITE_APP_VERSION
RUN bun run --filter admin build

FROM nginx:1.27-alpine AS admin
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin-builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# Datadog RUM proxy
# =============================================================================
FROM base-builder AS proxy-builder
RUN bun run --filter proxy build

FROM node:24 AS proxy
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/proxy ./apps/proxy

COPY --from=proxy-builder /app/apps/proxy/dist ./apps/proxy/dist
COPY --from=proxy-builder /app/node_modules ./node_modules
COPY --from=proxy-builder /app/apps/proxy/node_modules ./apps/proxy/node_modules

ENV NODE_ENV=production
ENV PORT=8082
EXPOSE 8082

WORKDIR /app/apps/proxy
CMD ["dumb-init", "node", "dist/apps/proxy/src/server.js"]
