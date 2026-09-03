# Architecture

## Purpose

This document defines the architectural boundaries and major technical decisions for the KasbFlow platform.

## Decision log

| ADR | Decision |
| --- | --- |
| 001 | Modular monolith |
| 002 | PostgreSQL and Prisma |
| 003 | Inventory ledger as source of truth |
| 004 | Transaction boundaries owned by the application layer |
| 005 | Product identity and structured fields |
| 006 | Extensible technical attributes via JSONB |
| 007 | Units and future conversion |
| 008 | Price changes are history, not overwrites |
| 009 | B2B customer profile from day one |
| 010 | Warehouse-ready inventory |
| 011 | Server-side actor identity (Auth.js) |
| 012 | Authorization at the application boundary |
| 013 | Layered validation (Zod + domain invariants) |
| 014 | Explicit business history |
| 015 | Single tenant for milestone 1 |
| 016 | Persian-first interface |
| 017 | Simple operational model for the first release |
| 020 | Product named KasbFlow (کسب‌فلو) — verified free of software/trademark collisions (TradeFlow rejected: TRADEFLOW® is Expeditors' trade-management suite; Mojoud rejected: existing delivery app). Doroudi (درودی) is the customer, never the product identity |
| 021 | Money serialized as lossless decimal strings; BigInt never crosses a JSON boundary |
| 018 | Database migration deployment |

Each decision below records its rationale and consequences. If the decision log grows unwieldy, records will be split into `docs/adr/` files — not before.

The first release is intentionally a modular monolith. The architecture must support incremental growth without prematurely introducing microservices, multi-tenancy, ERP/accounting replacement, mobile applications, or other infrastructure that is not justified by current product requirements.

The primary architectural goals are:

* Correct business behavior over framework complexity
* Clear separation between business rules and infrastructure
* Transactional integrity for inventory and financial-adjacent operations
* Auditable business history
* Safe incremental schema evolution
* Simple deployment and operation for the first release
* Domain boundaries that allow future extraction when real scale requires it

---

## Architecture Style

### ADR-001: Modular monolith

The first release uses a single Next.js application with explicit domain and application boundaries.

The application is deployed and operated as one unit, while internal modules are kept sufficiently independent that a module can be extracted into a separate service later if real operational or scaling requirements justify it.

Microservices are not introduced speculatively.

The current architecture is:

```text
Browser / Client
       |
       v
Next.js App Router
       |
       +----------------------+
       |                      |
       v                      v
   UI / Pages          Route Handlers / API
                              |
                              v
                    Application / Use Cases
                              |
                              v
                         Domain Rules
                              |
                              v
                    Persistence Abstractions
                              |
                              v
                       Prisma / PostgreSQL
```

Next.js App Router and Route Handlers provide the HTTP/application entry points. Route Handlers live inside the `app` directory and expose HTTP methods without requiring a separate API application.

---

## Core Layers

### Presentation / HTTP

Location:

```text
app/
components/
```

Responsibilities:

* Pages and layouts
* Server and client UI components
* HTTP request/response handling
* Authentication/session access at the application boundary
* Mapping HTTP input into application commands
* Returning appropriate HTTP responses

Route handlers must remain thin.

They must not contain substantial business logic or directly implement complex inventory, pricing, customer, or sales rules.

A route should conceptually follow:

```text
HTTP request
    |
    v
Authentication
    |
    v
Input validation
    |
    v
Application use case
    |
    v
Domain rules
    |
    v
Persistence
    |
    v
HTTP response
```

---

### Application / Use Cases

Location:

```text
lib/application/
```

The application layer coordinates business use cases.

Examples:

```text
lib/application/products/
lib/application/customers/
lib/application/inventory/
lib/application/sales/
```

Responsibilities:

* Orchestrating business operations
* Defining transaction boundaries
* Calling domain rules
* Coordinating repositories/persistence
* Enforcing authorization requirements for use cases
* Converting application failures into predictable results

The application layer is the preferred owner of transaction boundaries.

Route handlers should not open arbitrary database transactions around business logic.

Example:

```text
POST /api/sales
       |
       v
createSale()
       |
       +--> validate command
       +--> authorize actor
       +--> apply domain rules
       +--> create sale
       +--> create stock movements
       +--> commit transaction
```

---

### Domain

Location:

```text
lib/domain/
```

The domain layer contains business rules that should be testable without requiring Next.js, HTTP, or a live database.

Suggested organization:

```text
lib/domain/
  products/
  pricing/
  inventory/
  customers/
  sales/
```

Domain code must not depend directly on:

* Next.js
* HTTP request/response objects
* Prisma Client
* browser APIs
* UI components
* framework-specific session objects

The purpose of this boundary is to keep business invariants independent from infrastructure.

---

### Persistence

Location:

```text
lib/db/
prisma/
```

Responsibilities:

* Prisma Client
* Repository implementations
* Database-specific queries
* Persistence mapping
* Database transaction integration

Prisma is the persistence mechanism, not the business layer.

Business rules must not be hidden inside arbitrary Prisma queries.

PostgreSQL is the system of record.

---

# Data Architecture

## ADR-002: PostgreSQL and Prisma

PostgreSQL is the system of record.

Prisma provides:

* Typed database access
* Schema representation
* Migration management
* Database client generation
* Transaction support

Database schema changes must be represented by versioned migration files and kept in source control.

Development uses Prisma development migration workflows.

Staging and production use the deployment migration workflow rather than development migration commands. Prisma documents `migrate deploy` for applying pending migrations in staging/production.

Production database migrations should preferably run as part of the deployment/CI/CD process rather than by manually changing a production connection string on a developer machine.

---

## ADR-003: Inventory ledger as source of truth

Inventory quantity is derived from `StockMovement` records.

Receiving and sales operations create inventory movements rather than silently overwriting a mutable stock quantity.

Conceptually:

```text
Receiving
    |
    +--> StockMovement (+)

Sale
    |
    +--> StockMovement (-)

Adjustment
    |
    +--> StockMovement (+/-)
```

Stock-changing operations must execute atomically.

The system must preserve the history necessary to explain how an inventory balance was produced.

Each movement may reference a warehouse.

This allows the first release to operate with one warehouse while keeping the data model ready for future multi-warehouse operation.

A mutable cached/aggregated quantity may be introduced later for performance, but it must not become an independent source of truth without an explicit architectural decision.

---

## ADR-004: Transaction boundaries

Any operation that changes multiple related business records must be atomic.

Examples include:

* Receiving inventory
* Completing a sale
* Stock adjustment
* Other future operations that modify multiple inventory/business records

The application/use-case layer owns the transaction boundary.

The desired pattern is:

```text
Use Case
   |
   +--- begin transaction
   |
   +--- validate business rules
   |
   +--- write business records
   |
   +--- write inventory movements
   |
   +--- commit
```

If any required operation fails, the transaction must roll back.

Database isolation level must be chosen according to the business operation and PostgreSQL behavior rather than assumed to be universally required.

---

# Product Domain

## ADR-005: Product identity and structured fields

Fields required for business operations must remain first-class database fields.

Examples include:

* SKU
* Barcode
* Brand
* Category
* Purchase price
* Sale price
* Stock-related relationships
* Product identity
* Other fields that require frequent filtering, sorting, joining, validation, or reporting

These must not be moved into generic JSON merely to avoid schema evolution.

---

## ADR-006: Product technical attributes are extensible

Electrical products have heterogeneous technical characteristics.

Examples include:

* Voltage
* Wattage
* Cross-section
* Number of poles
* Base type
* Other manufacturer-specific specifications

These may be stored as JSONB through the product `attributes` field.

JSONB is intended for genuinely variable technical specifications.

It must not become a replacement for core business entities or fields that require relational integrity, indexing, reporting, authorization, or transactional behavior.

For example, product price, stock, SKU, barcode, category, brand, and units must not be represented solely as arbitrary JSON attributes.

---

## ADR-007: Product units and future conversion

The product model must eventually support explicit units of measure where business operations require them.

Examples:

```text
piece
meter
roll
box
pack
kilogram
```

Unit conversion is deliberately outside the current MVP implementation.

When implemented, conversions must be explicit and deterministic.

For example:

```text
1 roll = 100 meters
1 box = 20 pieces
```

Conversions must not be inferred from product names or free-form text.

---

# Pricing

## ADR-008: Price changes are history, not overwrites

Current product prices remain directly available on the product for efficient reads.

Price changes are also recorded in `ProductPriceHistory`.

A price-history record should capture, where applicable:

* Product
* Purchase price
* Sale price
* Previous value
* New value
* Actor
* Timestamp
* Reason

The history provides provenance and allows future reporting on price changes.

Current price is an operational value.

Price history is the audit/provenance record.

---

# Customers

## ADR-009: B2B customer profile from day one

Customers carry sufficient structure for the intended business model even if the MVP does not enforce every associated workflow.

Current customer characteristics include:

* Customer type
* Company/business identity where applicable
* Payment terms
* Credit limit
* Customer history

Example customer types:

```text
retailer
contractor
company
other
```

Credit limits and payment terms are data attributes in the current milestone.

Full credit enforcement, accounts receivable, statements, collection workflows, and accounting integration are separate future capabilities and must not be implicitly implemented through customer fields.

---

# Warehouse

## ADR-010: Warehouse-ready inventory

The data model supports warehouse references on inventory movements.

Milestone 1 may operate with a single default warehouse.

The architecture must not require the entire inventory model to be redesigned when a second warehouse is introduced.

Future multi-warehouse functionality may include:

* Warehouse management
* Warehouse-specific stock
* Transfers
* Receiving by warehouse
* Sales fulfillment by warehouse
* Warehouse reporting

These are future application capabilities, not requirements for the first release.

---

# Authentication and Authorization

## ADR-011: Server-side actor identity

Authentication is handled through Auth.js.

The server determines the authenticated actor.

The application must never trust an actor/user ID supplied by the browser as proof of identity.

Conceptually:

```text
Request
   |
   v
Authenticated session
   |
   v
Actor
   |
   v
Authorization
   |
   v
Use Case
```

---

## ADR-012: Authorization at the application boundary

Authentication and authorization are separate concerns.

Authentication answers:

```text
Who is the actor?
```

Authorization answers:

```text
Is this actor allowed to perform this operation?
```

Authorization must be enforced server-side.

UI visibility is not a security boundary.

Examples of operations that may require authorization:

* Creating products
* Changing prices
* Receiving inventory
* Recording sales
* Creating customers
* Performing stock adjustments
* Administrative operations

Exact role capabilities are defined by the business requirements and must not be inferred solely from UI behavior.

---

# Validation and Error Handling

## ADR-013: Layered validation

External input is validated before entering the application use case.

The preferred flow is:

```text
HTTP input
    |
    v
Zod schema
    |
    v
Application command
    |
    v
Domain invariants
    |
    v
Persistence
```

Zod validation protects the application from malformed external input.

Domain validation protects the business invariants.

These are complementary and must not be treated as the same responsibility.

The domain layer must not depend on HTTP-specific validation objects.

Errors should be predictable and mapped at the application/HTTP boundary rather than leaking raw database or framework errors to users.

---

# Auditability

## ADR-014: Business history must be explicit

Business operations that materially affect inventory, pricing, or other sensitive operational state must preserve sufficient history to explain what happened.

Currently this includes:

* Stock movements
* Price history

Future operations may require explicit audit records, including:

* Stock adjustments
* Credit-limit changes
* Payment-term changes
* Administrative changes
* Other business-sensitive state transitions

An audit log must not be added merely for appearance.

Each audit requirement should be introduced when there is a concrete business or compliance reason to retain the event.

---

# Multi-tenancy

## ADR-015: Single tenant for milestone 1

The first release is single-tenant.

There is one customer/business configuration.

Multi-tenancy is intentionally deferred until real product requirements justify it.

However, application code must avoid hard-coding customer-specific business rules into generic domain logic.

Customer-specific configuration should be represented as configuration/data when it is genuinely configurable.

A future multi-tenant design must establish explicit tenant ownership and isolation rather than attempting to retrofit tenant IDs indiscriminately after data already exists.

---

# Localization

## ADR-016: Persian-first interface

The application uses:

* RTL layout
* Persian labels
* Persian-friendly presentation
* Localized date/number/currency formatting where appropriate

Internal storage must use canonical representations rather than localized display strings.

Examples:

* Monetary values use integer Rial amounts where appropriate.
* Timestamps are stored in UTC.
* Presentation converts values for Persian users.

The runtime must not depend on external CDNs for fonts or core application assets.

---

# Security Boundaries

The application follows these principles:

* Authentication is server-side.
* Authorization is server-side.
* Browser-provided identity is never trusted.
* Secrets are stored in environment configuration and never committed to source control.
* Database credentials are not embedded in source code.
* Input from external clients is validated.
* Database writes are performed through controlled application paths.
* Business-sensitive operations are transactional.
* Production database access is not embedded into developer-only workflows.

`.env` files containing secrets must remain outside version control.

---

# Deployment and Operations

## ADR-017: Simple operational model for the first release

The first release is designed to run as a conventional web application with PostgreSQL.

Conceptually:

```text
Internet
   |
   v
Reverse Proxy / HTTPS
   |
   v
Next.js Application
   |
   v
PostgreSQL
```

The deployment environment must provide:

* Environment variables/secrets
* PostgreSQL connectivity
* Application process management
* HTTPS/reverse proxy where required
* Database backup strategy
* Application logs
* Basic health monitoring

The first release does not require Kubernetes, service meshes, microservices, or distributed infrastructure.

Operational complexity must be justified by actual requirements.

---

## ADR-018: Database migration deployment

Database migrations are versioned with the application source.

The repository must contain the migration history required to reproduce the expected database schema.

For staging and production, pending migrations are applied using the production migration workflow:

```text
prisma migrate deploy
```

Migration deployment should be integrated into the release/CI/CD process when practical. Prisma explicitly recommends `migrate deploy` for staging/production and describes CI/CD integration as the preferred deployment pattern.

Production schema changes must not depend on manually editing the production database.

---

# Testing Strategy

Testing is divided by architectural layer.

## Domain tests

Domain rules should be testable without a live database.

Examples:

* Stock quantity calculations
* Product invariants
* Pricing rules
* Unit conversion rules when implemented
* Customer/business invariants

## Application tests

Application/use-case tests verify orchestration and transaction-sensitive behavior.

Examples:

* Receiving
* Sale completion
* Customer creation
* Price change recording

## Integration tests

Integration tests verify:

* Prisma/PostgreSQL behavior
* Transactions
* Constraints
* Repository behavior
* Migration compatibility

## HTTP smoke tests

HTTP-level smoke tests verify that the deployed application boundary actually works.

Examples:

* Authentication
* Protected routes
* Product APIs
* Customer APIs
* Inventory APIs
* Sales APIs

A passing typecheck or unit-test suite alone does not constitute successful end-to-end verification.

---

# Repository Structure

The intended high-level structure is:

```text
app/
  pages and layouts
  api/
    route handlers

components/
  reusable presentation components

lib/
  domain/
    pure business rules (inventory.ts + tests)
  db.ts
    prisma client singleton
  authz.ts
    requireRole() server-side authorization helper
  validation.ts
    zod request schemas
  serialize.ts
    bigint-safe JSON serialization

prisma/
  schema.prisma
  migrations/
  seed.ts

scripts/
  db-smoke.ts
    database round-trip smoke check

docs/
  PROJECT_OVERVIEW.md
  ROADMAP.md
  BUSINESS_RULES.md
  DATA_MODEL.md
  ARCHITECTURE.md
  TECHNICAL_OVERVIEW.md
  SECURITY.md
  CONTRIBUTING.md

auth.ts
auth.config.ts
middleware.ts
```

The exact directory structure may evolve as the codebase grows, but the dependency direction must remain clear.

---

# Dependency Rules

The following dependency direction is preferred:

```text
Presentation / HTTP
        |
        v
Application / Use Cases
        |
        v
Domain
        |
        v
Persistence Interfaces
        |
        v
Infrastructure / Prisma / PostgreSQL
```

The following patterns should be avoided:

```text
Route Handler
    |
    +--> complex business logic
    +--> arbitrary Prisma writes
    +--> duplicated authorization
    +--> duplicated validation
```

and:

```text
Domain
    |
    +--> Next.js
    +--> Prisma Client
    +--> HTTP
```

The domain must remain the most infrastructure-independent layer.

---

# Current Scope

The following are intentionally part of the current architectural foundation:

* Product management
* Categories and brands
* Customers
* B2B customer attributes
* Suppliers as currently modeled
* Inventory
* Stock movements
* Warehouse-ready inventory
* Receiving
* Sales
* Price history
* Product technical attributes
* Authentication
* Server-side authorization
* PostgreSQL persistence
* Prisma migrations
* Persian/RTL presentation
* Automated validation and testing

---

# Deferred Scope

The following are deliberately deferred unless business requirements trigger them:

* Purchase orders
* Supplier invoices
* Supplier payments
* Full procurement workflow
* Unit conversion implementation
* Accounts receivable
* Full accounting/ERP replacement
* Advanced credit enforcement
* Multi-tenancy
* Mobile applications
* Offline desktop synchronization
* Microservices
* Advanced warehouse transfers
* Industry-specific templates beyond the current product model

Deferred does not mean rejected.

Each item should become its own implementation milestone when there is a concrete business requirement and enough information to define its workflow correctly.

---

# Architectural Principle

The project should optimize for **domain correctness and controlled evolution**, not maximum feature count or maximum infrastructure.

The system should be capable of becoming a larger business platform, but the first release should remain operationally simple.

New abstractions should be introduced when they protect a real business boundary.

New infrastructure should be introduced when real scale, reliability, security, or operational requirements justify it.

The architecture should therefore prefer:

```text
Clear boundaries
+
Explicit business rules
+
Transactional operations
+
Auditable state changes
+
Versioned database evolution
+
Simple deployment
```

over premature complexity.

The objective is not to predict every future requirement.

The objective is to ensure that future requirements can be added without invalidating the core domain model.
