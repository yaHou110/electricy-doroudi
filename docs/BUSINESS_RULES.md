# Business Rules

## Inventory

* Every stock change creates an immutable stock movement.
* A stock movement records direction, quantity, reason, actor, timestamp, warehouse, and source operation when applicable.
* Current stock is derived from stock movements; a mutable stock quantity is not the authoritative source of truth.
* Stock is tracked per product and warehouse. The system must not assume that a product has only one physical stock location.
* Quantities must be positive at the input boundary. Direction determines whether stock increases or decreases.
* A receiving or sale operation must be atomic: either its business record and all related stock movements are committed together, or neither is committed.
* Retrying the same operation must not apply its stock change twice.
* Receipt and sale numbers are unique idempotency keys for the MVP.
* Reusing an existing receipt or sale number with materially different data must be rejected rather than treated as a new operation.
* A sale cannot reduce stock below zero unless an explicit negative-stock policy is introduced and approved.
* Inventory corrections must create explicit adjustment movements. Existing movements must never be edited or deleted to hide an error.
* Returns, cancellations, and reversals must be represented by compensating business operations and movements rather than by rewriting historical transactions.
* Transfers between warehouses must create a traceable source-to-destination operation. A transfer must not silently change the total quantity across warehouses.
* Stock movements must retain enough source information to determine which business operation caused the movement.

## Units and quantities

* Every product has a defined base unit of measure.
* The system must distinguish between the product's commercial unit and its stored/base unit when they differ.
* Unit conversions must be explicit and deterministic; the system must never infer a conversion from a product name or free text.
* Quantity conversion rules must preserve sufficient precision for the product category.
* The MVP may support a single base unit per product while keeping the domain model ready for future conversion rules.
* Products whose commercial quantities are naturally measured by length, weight, volume, area, piece, roll, box, or other units must not be forced into an implicit generic "quantity" concept without a defined unit.

## Products

* Every product has a stable identity independent of its display name.
* Product names, SKU/code, brand, category, unit, and technical attributes are distinct concepts.
* Technical product attributes may vary by product category and may be stored in extensible structured attributes where a fixed schema would create unnecessary schema churn.
* Technical attributes must not be used as a substitute for core transactional fields such as price, quantity, unit, SKU, or stock identity.
* Changing a product's descriptive information must not alter historical transactions.
* Deactivating a product must preserve its historical transactions and must not delete its inventory history.
* A product that has historical transactions must not be hard-deleted merely because it is no longer sold.

## Pricing

* Current purchase and sale prices are stored for fast operational reads.
* Price changes are recorded in price history rather than silently overwriting the historical record.
* A price-history record records the affected product, previous value where applicable, new value, actor, timestamp, and reason.
* Historical sales and receiving records retain the price applicable to the transaction at the time it was posted; they must not change when the product's current price changes.
* Price changes do not retroactively modify completed transactions.
* The MVP does not assume a single universal pricing model. Future customer-specific, quantity-based, promotional, or tiered pricing may be added without rewriting historical transaction prices.

## Money and time

* Monetary values are stored as exact integer Rial amounts or exact decimal values according to the financial field's requirements; floating-point values must never be used for monetary calculations.
* Currency must be explicit wherever a value could later support more than one currency.
* Monetary calculations must use deterministic rounding rules appropriate to the field.
* Timestamps are stored in UTC.
* User-facing dates and times are formatted for Persian users at the presentation boundary.
* Historical monetary records must retain the values that were actually used when the transaction was posted.

## Receiving

* Receiving goods increases stock only through a posted receiving operation.
* A receiving operation must identify the supplier when supplier information is part of the workflow.
* Receiving quantities and prices are captured at the time of receipt and must not depend on the product's current price.
* A receiving operation must have a unique business identifier.
* A failed receiving operation must not leave partial stock movements.
* A completed receiving operation must not be silently edited in a way that changes its historical stock effect.
* Corrections to a completed receipt must use an explicit reversal, return, or adjustment workflow.

## Sales

* A sale reduces stock only through a posted sales operation.
* A sale must identify the customer when the workflow requires customer information.
* Sale quantities and transaction prices are captured at posting time.
* A completed sale must retain the exact transaction values used at the time of posting.
* A sale must not use the product's current price after the sale has been posted.
* A failed sale must not leave partial stock movements.
* Duplicate submission of the same sale must not reduce stock twice.
* Cancellation or return of a completed sale must create an explicit compensating operation rather than deleting the original sale.

## Customers

* Customers have a stable identity independent of their display name.
* Customer type may distinguish retailer, contractor, company, and other supported business types.
* Business customers may have company name and relevant business information.
* Payment terms and credit limits are stored as customer attributes where applicable.
* Credit limits are informational until an explicit credit-control workflow is implemented.
* The MVP must not pretend that storing a credit limit constitutes enforcing credit policy.
* Historical sales must retain their customer association even if the customer's current profile later changes.
* Deactivating a customer must preserve historical transactions.
* Customer data must not be duplicated into sales records except where a historical snapshot is intentionally required.

## Warehouses

* A warehouse has a stable identity independent of its display name.
* Stock belongs to a warehouse through stock movements and related inventory records.
* Warehouse names must be unique within the system.
* The MVP may operate with one warehouse, but the domain model must not assume that one warehouse is the permanent limit.
* Adding another warehouse must not require changing the meaning of existing stock movements.
* Warehouse transfers must preserve an auditable relationship between the source and destination.
* A warehouse must not be deleted if doing so would orphan historical inventory records.

## Access and authorization

* Authorization is enforced on the server for every protected operation.
* Browser-supplied role, user ID, ownership, warehouse scope, or permission claims must never be trusted as authorization.
* Managers can view reports and manage users.
* Warehouse staff can receive goods and view stock within their permitted scope.
* Sales staff can record sales and view permitted customer and product information.
* Permissions must be evaluated for the requested operation, not merely for access to the page containing it.
* Sensitive operations such as inventory adjustments, reversals, user management, and future financial operations must have explicit permissions.
* The system should support separation of duties as the workflow becomes more financially significant; a user who can perform an operational action should not automatically receive approval authority for that action.
* If the organization is too small for complete separation of duties, compensating management review may be used rather than silently granting unrestricted permissions.

## Auditability

* Business records that affect inventory or financial history must retain actor and timestamp information.
* Historical transactions must be traceable to the user and business operation that created them.
* Audit information must not be dependent solely on client-side logs or browser state.
* Historical records must be append-only wherever practical.
* Corrections must preserve the original event and record the corrective event separately.
* Deleting a business record must never be used as a mechanism for erasing an already-posted inventory movement.
* The system should retain a clear relationship between business documents and the stock movements they generated.

## Validation and integrity

* Validation occurs at the request boundary before business operations are executed.
* Business rules must also be enforced server-side and, where appropriate, through database constraints.
* Invalid quantities, identifiers, prices, dates, duplicate document numbers, unauthorized operations, and invalid state transitions must be rejected.
* Database constraints must protect invariants that cannot safely depend on application code alone.
* Transactional operations must use appropriate database isolation and concurrency protection.
* Concurrent sales must not be able to consume the same final available stock.
* A successful transaction must leave the database in a state that can be reconstructed and audited from its durable records.

## Idempotency and retries

* Critical write operations must have a stable business identity that survives network retries.
* An exact retry of an already-completed operation must return or reference the existing result rather than applying the business effect again.
* Reusing an idempotency key with different business data must be rejected.
* Idempotency must be enforced server-side and must not depend on the client remembering whether a request succeeded.
* Idempotency and concurrency control are separate concerns: idempotency prevents duplicate processing, while concurrency control prevents conflicting simultaneous operations.

## Reconciliation

* The system must be able to recompute expected stock from the immutable movement history.
* Reconciliation must compare derived stock with any materialized operational balance if such a balance is introduced later.
* A discrepancy must not be silently repaired by overwriting the stock quantity.
* Inventory discrepancies must be resolved through an explicit, authorized adjustment or repair process.
* Reconciliation and repair actions must themselves be auditable.
* The MVP may provide basic reconciliation capabilities without implementing a full accounting reconciliation system.

## Scope boundaries

* The MVP is an inventory and sales-oriented business system, not a complete ERP or accounting replacement.
* Purchase orders, supplier invoices, supplier payments, accounts payable, accounts receivable, taxation workflows, accounting journals, and general-ledger integration are separate future milestones unless explicitly approved.
* Credit limits and payment terms may be stored before full credit-control and accounts-receivable workflows exist, but the system must not imply that those workflows are already implemented.
* Multi-warehouse support may begin with one warehouse while preserving the domain structure required for additional warehouses.
* Multi-tenancy is outside the MVP unless explicitly introduced as a product requirement.
* Advanced pricing, reservations, barcode workflows, serial/lot tracking, offline synchronization, and external ERP integrations are future capabilities unless explicitly included in a milestone.
