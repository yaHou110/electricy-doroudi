# Deployment & Operations

Practical runbook for running TradeFlow in development and on a single VPS. Everything here reflects the actual scripts in `package.json` and the compose file at the repo root.

## Topology (current)

```text
[Browser] → [Next.js app (node process)] → [PostgreSQL 16 (Docker)]
```

One machine hosts both the app process and the database container. There is no reverse proxy, TLS termination, or process supervisor wired up yet — see "Known gaps".

## Environment variables (`.env`, never committed)

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Prisma connection string | `postgresql://postgres:postgres@localhost:5432/tradeflow?schema=public` in dev; use the VPS-internal address in production. |
| `AUTH_SECRET` | Auth.js JWT signing key | Generate with `openssl rand -base64 32`. **Rotating it invalidates all sessions.** |
| `NEXT_PUBLIC_APP_NAME` | Display name in the UI | Cosmetic. |

## Development workflow

```bash
cp .env.example .env          # then edit AUTH_SECRET
docker compose up -d          # PostgreSQL 16 + healthcheck, volume tradeflow-postgres
npm install
npm run db:generate           # prisma generate
npx prisma migrate deploy     # apply committed migrations (or migrate dev while iterating)
npm run db:seed               # demo staff/customer/warehouse data (dev only)
npm run dev                   # http://localhost:3000
```

Health check: `curl -fsS http://localhost:3000/api/health` → `{"status":"ok","database":"ok"}`.

## Production workflow (single VPS)

1. **Provision**: install Docker + Compose plugin; clone the repo; create `.env` with a production `AUTH_SECRET` and the production `DATABASE_URL`.
2. **Database**: `docker compose up -d` and wait for `docker inspect --format '{{.State.Health.Status}}' <postgres container>` = `healthy`.
3. **Build**: `npm ci && npm run build` (runs `prisma generate` then `next build`).
4. **Migrate**: `npx prisma migrate deploy` — applies only committed migrations, in order, idempotent. Never edit an applied migration; corrections get new migrations.
5. **Run**: `npm run start` (or a process manager of choice). Do **not** seed in production.
6. **Verify**: `/api/health` returns ok; log in with a production account; post one test receipt.

### Update procedure (deploying new code)

```bash
git pull
npm ci
npm run build
npx prisma migrate deploy     # before starting the new build
# restart the app process
```

### Rollback

App: redeploy the previous commit (migrations are designed to be forward-only; check `docs/DATA_MODEL.md` for constraints a rollback could violate before reverting a schema change).
Database: point-in-time restore from backups — there is no automated down-migration path.

## Data management

* **Backups**: `docker exec <postgres container> pg_dump -U postgres -Fc tradeflow > backup-$(date +%F).dump`. Restore with `pg_restore -U postgres -d tradeflow --clean backup.dump`. Schedule daily dumps off-box; none are automated yet.
* **Migrations**: `prisma/migrations/` is the single source of truth. `migrate deploy` in production, `migrate dev` only in development.
* **Seed**: `npm run db:seed` is dev/demo only — it creates known staff accounts and must never run against production.

## Monitoring & logs

* **Health endpoint**: `GET /api/health` checks database connectivity (200/503) — wire it to an uptime monitor or `docker healthcheck`.
* **Logs**: the app writes to stdout/stderr; the process manager owns persistence. Route handlers return structured error codes (`docs/API.md`) but no request logging middleware exists yet.
* **Watch for**: `503 SERIALIZATION_RETRY_EXHAUSTED` responses (sustained concurrency pressure), slow `/api/dashboard` (full-table derivation), and disk growth of the `tradeflow-postgres` volume.

## Known gaps (honest list)

* No production Dockerfile or app container — the app runs on the host, the database in Compose.
* No reverse proxy/TLS; assume a fronting nginx/Caddy on the VPS.
* No automated backups, no request logging, no metrics/alerting.
* Single-node only; no horizontal scaling story (the ledger design tolerates it later).
