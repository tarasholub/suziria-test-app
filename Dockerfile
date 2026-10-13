# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# uv/uvx for the Python-based Fetch MCP server
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

RUN groupadd -r app && useradd -r -g app -m app

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# MCP config + sandbox for the filesystem server (read-only by tool whitelist)
COPY mcp.config.json ./
COPY sandbox ./sandbox

# npx needs a writable cache for stdio MCP servers; pre-warm them at build time
ENV npm_config_cache=/home/app/.npm
RUN mkdir -p /home/app/.npm && chown -R app:app /home/app /app

USER app

# Pre-fetch uvx/npx server packages so the first chat request isn't slow.
# stdio servers exit on stdin EOF, so </dev/null makes these terminate.
RUN timeout 60 uvx mcp-server-fetch </dev/null >/dev/null 2>&1 || true
RUN timeout 60 npx -y @modelcontextprotocol/server-filesystem ./sandbox </dev/null >/dev/null 2>&1 || true
RUN timeout 60 npx -y @modelcontextprotocol/server-sequential-thinking </dev/null >/dev/null 2>&1 || true

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
