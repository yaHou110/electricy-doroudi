# API Contract

This document describes the HTTP API **as implemented** in `app/api/`. Every route handler is the source of truth; when a handler changes, this document changes in the same commit. There is no versioning yet — the API is private to the Milestone 1 UI.

## General contract

| Concern | Behavior |
| --- | --- |
| Base path | `/api` under the same origin as the UI. |
| Auth | Cookie-based Auth.js JWT session (`auth()`), checked **inside every handler** via `authorize()` — never at middleware only. |
| Roles | `MANAGER`, `WAREHOUSE`, `SALES` (see `SECURITY.md` for the full matrix). |
| Body format | `application/json`. Malformed JSON → `400 INVALID_JSON`. |
| Validation | Zod schemas in `lib/validation.ts`, run **after** auth and **before** any business logic. Failures → `400 VALIDATION_ERROR` with `details` = Zod `flatten()` output. |
| Money | Rial integers. Stored as `BigInt`; **serialized to JSON as decimal strings** (lossless, `lib/serialize.ts`). Inputs accept a JSON integer **or** a decimal string (`"150000000"`); both are coerced to `BigInt` and capped at PostgreSQL's `int8` max. |
| Idempotency | Receipts and sales are idempotent by business number (below). |
| Concurrency | Stock-changing writes run in `Serializable` transactions with `SELECT … FOR UPDATE` row locks and a bounded retry (below). |
| Error shape | Every error is `{ "code": "<MACHINE_CODE>", "error": "<Persian message>", "details"?: <validation info> }`. |
| Pagination | **Not implemented.** List endpoints return full result sets (Milestone 1 scale is small); filtering/sorting is fixed in code. |

## Endpoints

### `GET /api/health`

Public. Runs `SELECT 1` against the database.
`200 { "status": "ok", "database": "ok" }` · `503 { "status": "error", "database": "unavailable" }`.

### `GET /api/dashboard`

Roles: all three. Returns dashboard metrics and lists. Money fields (`salesToday`, `totalInventoryValue`, `totalRial`) are decimal strings; `stock`, counters, and product fields are numbers. Stock is derived per product from the ledger; `salesToday` counts `COMPLETED` sales since UTC midnight.

### `GET /api/products`

Roles: all three. Active products with brand/category, ordered by name. `Cache-Control: private, max-age=30`.

### `POST /api/products`

Role: `MANAGER` only. Body per `productInputSchema` (sku, name, unit, prices, reorderPoint, optional brand/category/attributes). Creates the product **and** the initial `ProductPriceHistory` entry in one transaction.
`201` → product JSON · `409 PRODUCT_SKU_EXISTS` · `400 INVALID_REFERENCE` (unknown brand/category) · `400 VALIDATION_ERROR`.

### `GET /api/customers`

Roles: `MANAGER`, `SALES`. All customers, ordered by name.

### `POST /api/customers`

Roles: `MANAGER`, `SALES`. Body per `customerInputSchema`. `201` · `409 CUSTOMER_EXISTS` · `400 INVALID_REFERENCE` · `400 VALIDATION_ERROR`.

### `POST /api/receipts`

Roles: `MANAGER`, `WAREHOUSE`. Movements are stamped with the default warehouse; missing default warehouse → `503 NO_DEFAULT_WAREHOUSE`.

Body: `{ receiptNo, supplierId?, notes?, lines: [{ productId, quantity, unitCostRial }] }` — `quantity` positive integer ≤ 2³¹−1; each product may appear at most once.

Flow, in order: auth → parse/validate → **pre-check** for an existing `receiptNo` → serializable transaction: `FOR UPDATE` lock on all referenced products → verify all products exist and are active → create receipt + lines → create one `RECEIPT` stock movement per line → commit.

Responses:

| Status | Code | Meaning |
| --- | --- | --- |
| `201` | — | Created. `{ id, receiptNo }` |
| `200` | — | **Idempotent replay**: same `receiptNo` + same normalized payload (supplier, notes, line set/order-insensitive) as the stored receipt → original result, no second write. |
| `409` | `IDEMPOTENCY_CONFLICT` | Same `receiptNo` but **different** payload. Also returned if a replay race erased the stored document mid-request. |
| `400` | `PRODUCT_NOT_FOUND` | Unknown or inactive product id. |
| `400` | `INVALID_REFERENCE` | Unknown `supplierId`. |
| `503` | `SERIALIZATION_RETRY_EXHAUSTED` | Three serializable attempts failed (`P2034`); safe to retry the request. |
| `400` | `VALIDATION_ERROR` / `INVALID_JSON` | Malformed input. |

### `POST /api/sales`

Roles: `MANAGER`, `SALES`. Same warehouse stamping as receipts, plus:

* Stock check: current stock is derived from the ledger inside the transaction; any line pushing stock below zero → `409 INSUFFICIENT_STOCK`.
* `totalRial` is computed server-side as `Σ quantity × unitPriceRial` in `BigInt` — the client never sends the total.
* Writes one `SALE` movement per line with `soldBy` set to the authenticated user.

Error codes are the receipt set plus `409 INSUFFICIENT_STOCK`; success/replay bodies use `saleNo`.

## Idempotency semantics (normative)

The business number (`receiptNo`/`saleNo`) is the idempotency key. The comparison is a **canonical fingerprint** (`lib/idempotency.ts`): supplier/customer, notes, and lines — with lines sorted by `productId` and prices stringified — so a retry with lines in a different order still replays.

* Same number + same payload → `200` with the original document identity. No duplicate stock effects.
* Same number + different payload → `409 IDEMPOTENCY_CONFLICT`. The client must pick a new number; the stored document is never modified.
* Two concurrent first-time requests with the same number: one commits, the loser hits the unique constraint (`P2002`) and is converted to the same replay/conflict decision — no double ledger writes.

This is replay-by-detection, not request-deduplication storage: Milestone 1 keeps no separate idempotency-key table.

## Concurrency semantics (normative)

* Every stock-changing write takes `SELECT … FOR UPDATE` on all referenced `Product` rows (deterministic id order to avoid lock-order deadlocks) inside a `Serializable` transaction.
* If PostgreSQL aborts with a serialization failure (`P2034`), the transaction is retried up to **3 attempts** with exponential backoff (25 ms, 50 ms) in `runSerializableTransaction` (`lib/db.ts`). A failed attempt writes nothing — retries cannot double-apply stock effects.
* After the final failed attempt the API returns `503 SERIALIZATION_RETRY_EXHAUSTED`; the request is safe to repeat.
* Reads (dashboard, lists) are not serialized and may lag a write by milliseconds.

## Known gaps (honest list)

* No pagination, filtering, or sorting parameters — fine at Milestone 1 scale, revisit with real data volume.
* No `PATCH`/`DELETE` for any resource yet; corrections to posted documents are roadmap, not implementation.
* No request-level rate limiting; see `SECURITY.md`.
* Stock is derived system-wide; per-warehouse reads/transfer flows are future work.
