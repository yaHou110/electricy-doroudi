# Droudian Platform

Persian-first inventory and sales foundation for electrical distributors.

## Run locally

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npm run db:generate`.
5. Create the database schema with `npx prisma migrate dev --name init`.
6. Seed development data with `npm run db:seed`.
7. Start the app with `npm run dev` and open `http://localhost:3000`.

The dashboard UI includes representative preview values while the database-backed reporting API is being configured. The login screen and product/receipt forms use the real Auth.js and Prisma paths and require PostgreSQL, a migrated schema, seeded user, and authenticated staff session before they work end to end.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

See `docs/` for scope, business rules, architecture, and roadmap.
