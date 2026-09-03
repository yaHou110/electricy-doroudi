# Security

This document describes how authentication, authorization, and data protection actually work in Milestone 1, followed by an honest list of known gaps. It answers: who may do what, where that is enforced, and how the system protects inventory and customer data.

## Authentication

* Credentials-based staff login via Auth.js (NextAuth v5). Email lookup is case-insensitive/trimmed; passwords are verified with bcrypt (seed uses cost 12).
* Sessions are **stateless JWT** (default 30 days); `id` and `role` are embedded into the token at sign-in and exposed on `session.user` via typed augmentations (`types/next-auth.d.ts`).
* The user's database role is captured once at login. Role changes take effect on the next sign-in, not mid-session.
* Custom sign-in page: `/login`. No self-registration; users exist only through seeding/administration.
* Middleware (`middleware.ts` + `auth.config.ts`) guards pages: everything except `/login` and `/api/auth/*` requires a session and redirects to login. API routes deliberately pass through middleware and enforce auth themselves.

## Authorization

* **Enforcement is always server-side**, in the route handler, via `requireRole(roles)` (`lib/authz.ts`) which reads the session server-side and returns the actor or null. UI hiding is convenience only.
* `requireRole` never trusts browser-supplied user IDs or role claims; the actor identity comes from the signed session token.
* Role model: single role per user, three roles.

| Operation (route)                     | MANAGER | WAREHOUSE | SALES |
| ------------------------------------- | :-----: | :-------: | :---: |
| `GET /api/products`                   |   ✅    |    ✅     |  ✅   |
| `POST /api/products` (create product) |   ✅    |    ❌     |  ❌   |
| `GET /api/customers`                  |   ✅    |    ❌     |  ✅   |
| `POST /api/customers`                 |   ✅    |    ❌     |  ✅   |
| `POST /api/receipts` (receive goods)  |   ✅    |    ✅     |  ❌   |
| `POST /api/sales` (record sale)       |   ✅    |    ❌     |  ✅   |
| `GET /api/dashboard`                  |   ✅    |    ✅     |  ✅   |

* Authorization is checked per operation (method), not merely per page. Sensitive operations such as stock adjustment, user management, and price editing have no endpoints yet, so there is nothing to authorize — they will ship with explicit permissions.

## Validation and error handling

* Every mutating endpoint parses input with a Zod schema (`lib/validation.ts`) **before** any business logic: positive-integer quantities, non-negative integer Rial prices, bounded string lengths, enum checks, UUID references.
* Referenced products are re-verified inside the transaction (active + existing) — a valid UUID for a deleted/inactive product is rejected.
* Business-rule failures are raised as typed errors and mapped to stable HTTP codes: `400` invalid input/unknown product, `401` unauthenticated, `403` wrong role, `409` duplicate business number, insufficient stock, or generic failure. Unexpected failures fall through to a generic `409`/`500`-style Persian message.
* Error responses never include stack traces, Prisma internals, or credentials. Zod issue details are flattened into the 400 body (field-level feedback for the UI).

## Secrets and configuration

* Secrets live in environment variables only: `DATABASE_URL`, `AUTH_SECRET` (JWT signing), loaded via `dotenv`/Next env handling. `.env` is git-ignored (`.gitignore`); `.env.example` documents the shape without real values.
* No secret, connection string, or credential is embedded in source code. The seeded dev password is development-only and documented as never-production.
* HTTPS termination is a deployment concern (reverse proxy on the target VPS); the runtime assumes a trusted proxy in front.

## Data protection posture

* All DB access goes through Prisma's parameterized query API — no string-built SQL.
* Monetary/inventory data is protected transactionally (see `DATA_MODEL.md`); inventory and customer records are never exposed through public endpoints — every API route requires an authenticated, authorized session.
* Audit trail today: stock movements and price history record the acting user and timestamp; login attempts are not yet logged.
* React escapes rendered content by default; no `dangerouslySetInnerHTML` usage exists.

## Known gaps (honest list)

The following are **not** implemented in Milestone 1 and must not be assumed:

* **No rate limiting** on login or API routes (brute-force protection is deployment/proxy-level today).
* **No account lockout, password reset, or user management UI/API**; "manage users" is roadmap.
* **No audit log for authentication events** (successful or failed logins are invisible to the system).
* **Role changes require re-login**; there is no session revocation or token invalidation mechanism beyond JWT expiry.
* **JWT is stateless and cannot be revoked**; a leaked token is valid until expiry (mitigation: short lifetime or a jti-based revocation list when justified).
* **No CSRF token for the credentials flow** beyond what Auth.js provides by default; API routes themselves are session-cookie authenticated and same-origin by deployment posture.
* **No field-level encryption** for customer PII (phone numbers are stored in plain text); disk-level protection is delegated to the database/VPS.
* Password policy is not enforced in code (only length via Zod at seed time is dev-only).

Rate limiting, login audit events, and user administration are the first three items to consider for Milestone 2 hardening.
