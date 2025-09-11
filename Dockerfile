# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine

# --- deps: install node_modules with cache -----------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: build Next -----------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# If ESLint blocks your build and you want to ship now:
#   set eslint.ignoreDuringBuilds: true in next.config.ts
RUN npm run build

# --- runner: minimal image with standalone server ----------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Copy the standalone server, static assets, and public
COPY --from=builder /app/.next/standalone ./       
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Run as nonroot
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]

