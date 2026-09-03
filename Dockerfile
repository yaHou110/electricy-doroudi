# syntax=docker/dockerfile:1

# --- Dependencies -----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is required by prisma generate; the value is never baked into the image.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

# --- Runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Prisma client + query engine and the migrations for `migrate deploy` on startup tooling.
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=app:app /app/prisma ./prisma

USER app
EXPOSE 3000

CMD ["node", "server.js"]
