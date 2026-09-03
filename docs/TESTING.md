# Testing Strategy

This document describes the test strategy **as implemented** plus the explicit policy for what must be tested as the project grows. `vitest` is the single runner (`vitest.config.ts`, node environment).

## Commands

```bash
npm run typecheck   # tsc --noEmit — strict; part of the contract, not optional
npm run lint        # eslint
npm test            # vitest run (all unit tests)
npm run build       # prisma generate && next build — catches route/type drift
```

All four are expected to pass before every commit. `typecheck` is the first defense; it is not a substitute for tests of transaction behavior, which TypeScript cannot see.

## Current coverage (implemented)

Unit tests (`*.test.ts` next to the code they cover, run by `npm test`):

| Suite | Covers |
| --- | --- |
| `lib/domain/inventory.test.ts` | Stock derivation from signed movements; rejection of over-selling, zero, and fractional quantities. |
| `lib/serialize.test.ts` | BigInt → decimal-string JSON serialization is lossless beyond 2⁵³. |
| `lib/idempotency.test.ts` | Fingerprints are order-insensitive for identical payloads and change when supplier/notes/customer/quantities/prices differ. |

Verification scripts (not vitest, executed against the real database):

* `scripts/db-smoke.ts` — round-trip through the real schema: product, receipt with lines, `RECEIPT` movement, warehouse, actor. Rerunnable (cleans its own fixture first).
* `scripts/service-check.ts` — service-layer integration checks against the real database, rerunnable: receiving (create/replay/conflict, warehouse stamping, exactly-once ledger effects), sales (stock derivation, insufficient-stock rejection). Run with `npx tsx scripts/service-check.ts`.
* Live API checks (login, 401 without session, 409 on duplicate receipt) are performed manually against `npm run dev` per the runbook in `DEPLOYMENT.md`.
* Container check: `docker build` + run against the compose database; `/api/health` must return ok with clean auth logs (this check caught a real `UntrustedHost` production blocker).

## Policy: what must always be tested when changed

1. **Money** — any change to money handling must keep values lossless end to end: input (string/number → `BigInt`), storage (`int8`), serialization (`BigInt` → decimal string). No Rial value may traverse JavaScript `Number` where precision can be lost.
2. **Idempotency** — changes to receipt/sale handling must preserve: same number + same payload → safe replay; same number + different payload → deterministic `409`; no duplicate ledger rows under retry.
3. **Concurrency** — changes to `runSerializableTransaction` or `lockProductRows` must not break the bounded `P2034` retry, must keep deterministic lock ordering, and must guarantee failed attempts write nothing.
4. **Validation ordering** — auth before validation before business logic; error responses keep the `{ code, error, details? }` shape.

## Planned (when justified — see ROADMAP)

* **vitest integration suites** promoted from `scripts/service-check.ts` against a disposable PostgreSQL (receipt → sale → derived stock; duplicate number; insufficient stock; rollback leaves no partial writes). Trigger: before the first multi-user deployment.
* **Concurrency tests** proving two parallel sales cannot both consume the last units, and that `P2034` retries converge. Trigger: same as above.
* **Authorization tests** enumerating the RBAC matrix (`SECURITY.md`) per endpoint. Trigger: any new endpoint or role change.
