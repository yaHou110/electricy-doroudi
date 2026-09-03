# Technical Overview

## Stack

- Next.js 15 App Router
- TypeScript in strict mode
- PostgreSQL
- Prisma ORM
- Tailwind CSS through the application stylesheet
- Zod for request validation
- Vitest for domain tests
- Docker Compose for local and VPS deployment

## Runtime

The production target is a Linux VPS. Configuration is provided through environment variables. The app must not depend on an external CDN for its core runtime or fonts.

## Data conventions

- Database identifiers use stable UUIDs.
- Money is stored as integer Rial amounts.
- Stock movement quantities are integer units for the MVP.
- Database timestamps are UTC.
- Input validation occurs at route boundaries and business functions.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before a release. Database-dependent checks require a PostgreSQL `DATABASE_URL`.
