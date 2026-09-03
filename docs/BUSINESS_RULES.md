# Business Rules

## Inventory

- Every stock change creates an immutable stock movement.
- A stock movement has a direction, quantity, reason, actor, timestamp, and source operation when applicable.
- Current stock is the sum of movements; a mutable stock quantity is not the source of truth.
- Quantities must be positive at the input boundary. Direction determines whether stock increases or decreases.
- A receiving or sale operation must be atomic: either its business record and stock movements are committed together, or neither is committed.
- Retrying the same operation must not apply its stock change twice; receipt and sale numbers are unique idempotency keys for the MVP.
- A sale cannot reduce stock below zero unless an explicit negative-stock policy is introduced and approved.

## Money and time

- Monetary values are stored as integer Rial amounts or exact decimal values, never floating point values.
- Product price changes are recorded in price history with actor, timestamp, and reason.
- Timestamps are stored in UTC and formatted for Persian users at the UI boundary.
- Product descriptions and labels must support Persian text and RTL layout.

## Access

- Managers can view reports and manage users.
- Warehouse staff can receive goods and view stock.
- Sales staff can record sales and view customer/product information.
- Authorization is enforced on the server for every protected operation.
