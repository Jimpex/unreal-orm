# ----------- Dependency Install Stage -----------
FROM node:20 AS deps
WORKDIR /repo

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo files for dependency resolution
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps ./apps
COPY packages ./packages

# Install dependencies (all workspaces)
RUN pnpm install --frozen-lockfile

# ----------- Build Stage -----------
FROM oven/bun:1.2.16 AS builder
WORKDIR /repo

# Copy installed deps and source
COPY --from=deps /repo /repo

# Build the docs app (uses bun for copy-docs, then astro build)
WORKDIR /repo/apps/docs
RUN bun run copy-docs && bunx astro build

# ----------- Production Stage -----------
FROM oven/bun:1.2.16 AS runner
WORKDIR /app

# Copy built output and only what's needed for runtime
COPY --from=builder /repo/apps/docs/dist ./dist
COPY --from=builder /repo/apps/docs/package.json ./

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

CMD bun ./dist/server/entry.mjs
