# Architecture

## Decision record

### ADR-001: Modular monolith

The first release uses one Next.js application with clear domain modules. This keeps deployment and operations simple while leaving boundaries for later extraction if real scale requires it.

### ADR-002: PostgreSQL and Prisma

PostgreSQL is the system of record. Prisma provides typed data access and migrations. The schema is designed for append-only inventory movements and transactional business operations.

### ADR-003: Inventory ledger as source of truth

Stock is derived from `StockMovement` rows. Receiving and sales create movements within a transaction. This preserves audit history and avoids silent overwrites of stock quantities. Movements carry an optional warehouse reference so multi-warehouse reporting becomes a data decision later, not a schema rewrite.

### ADR-004: Single tenant for milestone 1

The first release has one customer configuration. Tenant isolation is intentionally deferred until a second real tenant exists; shared code must still avoid customer-specific hard-coding.

### ADR-005: Persian-first interface

The application uses RTL layout, Persian labels, and localizes formatting at the presentation boundary. The runtime must not depend on external CDNs for fonts or core assets.

### ADR-006: Product attributes are extensible

Electrical products carry heterogeneous technical attributes (voltage, cross-section, wattage, poles). These are stored as JSONB on the product rather than forcing every vertical's attributes into fixed columns.

### ADR-007: Price changes are history, not overwrites

`ProductPriceHistory` records purchase/sale price changes with actor, timestamp, and reason. Current prices live on the product for fast reads; history exists because price volatility makes provenance a business requirement in this market.

### ADR-008: B2B customer profile from day one

Customers carry type (retailer/contractor/company), payment terms, and a credit limit even if the MVP does not enforce credit checks yet. Capturing the shape now avoids a painful customer-table migration later.

## Boundaries

- `app/`: routes, pages, and route handlers.
- `lib/domain/`: pure business rules that can be tested without a database.
- `lib/db/`: Prisma client and persistence helpers.
- `prisma/`: schema, migrations, and seed data.
- `components/`: reusable presentation components.
- `auth.ts`, `auth.config.ts`, `middleware.ts`: Node and edge-safe authentication boundaries.
