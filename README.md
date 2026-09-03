# KasbFlow

Persian-first inventory and sales foundation for electrical distributors.

## What it is

A modular-monolith web application for receiving goods, maintaining an auditable stock ledger, recording sales, and giving staff an operational dashboard. Milestone 1 (inventory core) is implemented and verified: staff login with role-based access, products/brands/categories, customers, goods receiving, transactional sales with stock validation, and an immutable stock-movement ledger.

## Stack

Next.js 15 (App Router) · TypeScript (strict) · PostgreSQL · Prisma · Auth.js (credentials + JWT sessions) · Zod · Tailwind · Vitest · Docker Compose.

## Run locally

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate the Prisma client with `npm run db:generate`.
5. Create the database schema with `npx prisma migrate dev --name init`.
6. Seed development data with `npm run db:seed`.
7. Start the app with `npm run dev` and open `http://localhost:3000`.

All data on the dashboard comes from the real database: staff login (Auth.js), products, customers, goods receiving, and transactional sales with stock validation are fully wired end to end. See `docs/DEPLOYMENT.md` for setup and `docs/API.md` for the API contract.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentation

| Document | Question it answers |
| --- | --- |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | What are we building, and for whom? |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What is being built now, and what is deliberately not? |
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | What rules does the business enforce? |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | What data exists, how is it related, what is immutable? |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How is the system structured, and why? |
| [`docs/TECHNICAL_OVERVIEW.md`](docs/TECHNICAL_OVERVIEW.md) | Which technologies and conventions? |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Who can do what, and how is the system protected? |
| [`docs/API.md`](docs/API.md) | What does the HTTP API accept, return, and guarantee? |
| [`docs/TESTING.md`](docs/TESTING.md) | What is tested, and what must be tested when changed? |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | How is it run, backed up, updated, and rolled back? |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | How should this project be changed? |
