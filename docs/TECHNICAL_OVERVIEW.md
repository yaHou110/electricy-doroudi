# Technical Overview

## Stack

* Next.js 15 App Router
* TypeScript in strict mode
* PostgreSQL
* Prisma ORM
* Tailwind CSS through the application stylesheet
* Zod for request validation
* Vitest for domain and application tests
* Docker Compose for local development and VPS deployment

## Architecture

The application is implemented as a modular monolith.

* `app/`: routes, pages, route handlers, and application entry points.
* `lib/domain/`: pure business rules and domain logic that should remain independent from the database and UI where practical.
* `lib/db.ts`: Prisma client singleton; persistence helpers and database-specific operations live near it as the codebase grows.
* `prisma/`: schema, migrations, and seed data.
* `components/`: reusable presentation components.
* Authentication configuration remains isolated from domain logic.

Business rules must not be embedded directly into UI components.

Route handlers are responsible for HTTP concerns, authentication/authorization checks, input validation, and invoking application/domain logic. Database access should remain behind the persistence boundary rather than being scattered throughout the UI.

The architecture must preserve clear module boundaries so that individual domains can later be extracted or reorganized if operational complexity justifies it. No premature microservice architecture is required for the current product.

## Runtime

The production target is a Linux VPS.

The application must be deployable as a self-contained service using environment-based configuration.

The runtime must not depend on external CDNs for core application assets, fonts, authentication, or normal application operation.

Environment-specific configuration and secrets must never be committed to source control.

Development and production configuration must remain explicitly separated.

## Database

PostgreSQL is the system of record.

Prisma is used for schema management, typed database access, and migrations.

Database schema changes must be represented by version-controlled migrations rather than undocumented manual changes.

The complete Prisma migration history and schema must remain in source control.

Production deployments must apply pending migrations using the appropriate deployment migration workflow rather than development-only database commands.

Database operations that represent a single business action must use transactions where atomicity is required.

## Data conventions

* Database identifiers use stable UUIDs.
* Monetary values are stored as integer Rial amounts.
* Floating-point numbers must not be used for monetary values.
* Stock quantities are integer units for the MVP.
* Database timestamps are stored in UTC.
* Persian dates, numbers, labels, and RTL presentation are handled at the presentation boundary.
* Product technical attributes may use structured JSON data where the domain intentionally requires extensibility.
* Database constraints and unique indexes should enforce critical invariants whenever practical rather than relying only on application code.

## API and validation

API route handlers are server-side boundaries.

Every protected API operation must independently verify authentication and authorization.

Client-supplied identity must never be trusted as the source of the acting user's identity.

Request payloads must be validated at the API boundary using Zod or an equivalent explicit validation layer.

Validation errors must be returned in a predictable format.

Business validation must also exist inside domain/application logic when an invariant must hold regardless of which interface invokes the operation.

The system must not assume that a browser UI is the only caller of the API.

## Authentication and authorization

Authentication is handled server-side.

Authorization is role-based for the current release.

Roles must be checked on the server for every protected operation.

The application must distinguish authentication from authorization:

* Authentication determines who the actor is.
* Authorization determines whether that actor may perform the requested operation.

Sensitive operations must not become accessible merely because a route is hidden from the UI.

## Inventory integrity

Inventory is based on immutable stock movements.

Receiving and sales operations that modify inventory must be transactional.

Stock-changing operations must be designed so that retries cannot accidentally apply the same business operation twice.

Current stock is derived from the stock ledger rather than being treated as an independently authoritative mutable value.

Warehouse references are part of the inventory model even though the initial release may operate with one warehouse.

## Money and pricing

Money must use exact representations suitable for financial values.

The MVP uses integer Rial amounts.

Current product prices may be stored directly on the product for efficient reads, while price changes are preserved in a separate history.

Price history records the relevant actor, timestamp, previous value, new value, and reason where applicable.

No monetary calculation may depend on JavaScript floating-point arithmetic.

## Error handling

Application errors must be explicit and predictable.

The system should distinguish at least:

* Validation errors
* Authentication failures
* Authorization failures
* Not-found conditions
* Business-rule violations
* Conflict/idempotency failures
* Unexpected infrastructure or database failures

Internal database details, secrets, stack traces, and implementation-specific information must not be exposed to end users through API responses.

Unexpected errors must be logged appropriately without leaking sensitive information.

## Observability and auditability

Business-critical operations must retain enough information to reconstruct what happened.

Inventory movements must record their actor, timestamp, direction, quantity, reason, and source operation where applicable.

Price changes must retain their history.

Authentication and authorization failures should be diagnosable through server-side logs without storing unnecessary sensitive information.

The system should favor structured server-side logging over ad-hoc console output as operational maturity increases.

## Testing

The verification baseline for every release is:

* `npm run typecheck`
* `npm run lint`
* `npm test`
* `npm run build`

Tests should cover business invariants independently from the UI.

Critical database-dependent behavior must also be tested against a real PostgreSQL instance rather than relying exclusively on mocks.

At minimum, inventory tests should verify:

* Receiving increases stock correctly.
* Sales decrease stock correctly.
* Stock cannot become negative under the current policy.
* Stock movements are immutable.
* Failed transactions do not leave partial inventory changes.
* Retrying the same operation does not duplicate its stock effect.
* Warehouse-specific stock calculations remain consistent.

Vitest is used for application and domain testing; its type-testing facilities may also be used where compile-time contracts need explicit verification.

## Database-dependent development

Local development uses PostgreSQL through Docker Compose.

A developer must be able to start the required database services locally without depending on an external hosted database.

Database-dependent verification must clearly report when PostgreSQL is unavailable rather than silently skipping critical checks.

Seed data is intended for development/testing only and must never be treated as production business data.

## Deployment

The application is designed for deployment to a Linux VPS.

Deployment should follow this general sequence:

1. Build the application.
2. Verify typecheck, lint, tests, and production build.
3. Ensure the target PostgreSQL database is available.
4. Apply pending production migrations.
5. Start or restart the application.
6. Perform a basic health/smoke check.

Production migration commands must be safe for an existing database and must not use destructive development commands such as a database reset.

Prisma's migration tooling distinguishes development migration creation/application from production migration deployment; the production workflow should use the deployment-oriented migration command.

## Security principles

* Secrets must be supplied through environment variables or the deployment secret mechanism.
* `.env` files containing secrets must not be committed.
* Server-side authorization is mandatory for protected operations.
* Client-provided actor/user IDs must never determine authorization.
* Database queries must use parameterized ORM operations or otherwise safe query mechanisms.
* User-controlled content must be validated and safely rendered.
* Error responses must not expose secrets, stack traces, database credentials, or internal infrastructure details.
* Destructive or irreversible operations should require explicit server-side business validation.

## Dependency and infrastructure policy

The application should prefer stable, well-supported dependencies over unnecessary libraries.

A dependency should only be introduced when it provides meaningful functionality that would otherwise require disproportionate custom code or operational complexity.

Core application functionality should not depend on a third-party SaaS service unless that dependency is explicitly documented and accepted as part of the product architecture.

The initial architecture intentionally avoids unnecessary infrastructure such as microservices, message brokers, Kubernetes, or distributed caching.

Those technologies may be introduced later only when actual product requirements justify them.

## Verification before release

A release is considered technically acceptable only when:

* TypeScript compilation passes.
* Lint passes.
* Automated tests pass.
* Production build succeeds.
* Database migrations are valid and applied successfully in the target environment.
* Critical database-dependent workflows have been smoke-tested.
* Authentication and authorization have been verified for protected operations.
* No unintended secrets or local environment files are included in the repository.
* The Git working tree contains only intentional changes.

The goal is not merely to produce a successful build. The goal is to ensure that the application remains deployable, testable, auditable, and extensible as additional business domains are introduced.
