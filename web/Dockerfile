# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────
# WhereTF production image
#
#  * Multi-stage, relies on next.config's `output: "standalone"` so the
#    runtime layer has no node_modules or dev deps.
#  * Non-root runtime user.
#  * Multi-arch: builds linux/amd64 and linux/arm64 via buildx.
#  * Health endpoints: /api/health (liveness), /api/health/ready (db).
#  * No secrets in the image — DATABASE_URL is injected at runtime.
# ──────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20

# ── deps ─────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# ── builder ──────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Reused node_modules from deps stage so rebuilds don't re-install.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# A dummy DATABASE_URL so Next's build step can import drizzle without
# trying to actually connect. Real URL is injected at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ── migrator ─────────────────────────────────────────────────────────
# Tiny image that exists solely to run `drizzle-kit migrate` as a
# one-shot task. Built as a separate stage so the app runner image
# doesn't have to carry drizzle-kit (dev dep).
#
# Usage:
#   docker build --target migrator -t wheretf/migrate .
#   docker run --rm -e DATABASE_URL=... wheretf/migrate
FROM node:${NODE_VERSION}-alpine AS migrator
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund
COPY db ./db
COPY drizzle.config.ts ./drizzle.config.ts
USER node
CMD ["npx", "drizzle-kit", "migrate"]

# ── runner ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server bundle + public assets + static chunks.
# Drizzle migrations ride along so the deploy system can run them via
# a one-shot container (see deployment.md).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
