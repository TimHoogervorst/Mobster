# ─── Builder Stage ───────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY package.json turbo.json tsconfig.json ./

# Copy package source (needed for workspace resolution)
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/drizzle.config.ts packages/db/
COPY apps/web/package.json apps/web/
COPY apps/web/tsconfig.json apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/src packages/shared/src/
COPY packages/db/src packages/db/src/
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.ts apps/web/
COPY apps/web/tailwind.config.ts apps/web/
COPY apps/web/postcss.config.js apps/web/

# Build
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build --filter=@mobster/web

# ─── Runner Stage ────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Create non-root user
RUN addgroup -g 1001 mobster && \
    adduser -u 1001 -G mobster -s /bin/sh -D mobster

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Create data directory for SQLite
RUN mkdir -p /data /workspaces && \
    chown -R mobster:mobster /data /workspaces

USER mobster
EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/data/mobster.db
ENV WORKSPACE_PATH=/workspaces

CMD ["node", "apps/web/server.js"]
