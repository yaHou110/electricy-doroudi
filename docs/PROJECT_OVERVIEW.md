# Electricy Doroudi

Electricy Doroudi (الکتریکی درودی) is a Persian-first business management platform for the Doroudi electrical business — inventory, purchasing/receiving, sales, customers, pricing, and staff operations in one modular system. Its initial focus is on the operational workflows that matter most to a distributor: receiving goods, maintaining reliable stock history, recording sales, managing customers and products, and giving staff and managers a clear operational dashboard.

The first deployment is for **Doroudi (درودی)**, an electrical equipment distributor; the electrical domain shapes the seed data and initial taxonomy, but no business logic depends on it.

The platform is intentionally being developed as a modular business product rather than as a full ERP in the first release. Accounting, advanced procurement, complex CRM, and other broader ERP capabilities are outside the scope of the initial milestone and may be added later when validated by real business requirements.

## Users

* **Manager:** monitors stock, sales, customers, and operational summaries.
* **Warehouse staff:** receives goods and records stock movements.
* **Sales staff:** searches products, records sales, and manages customer information.

## Product direction

The platform is named after the business it serves: **Electricy Doroudi (الکتریکی درودی)**. Earlier working titles were considered and rejected during the naming review; the owner chose the business's own brand, in Persian, as the single identity.

Customer-specific branding, labels, configuration, and operational settings belong in configuration rather than hard-coded business logic. Business behavior that is broadly useful to distributors should remain part of the shared product.

The architecture should therefore support future reuse without prematurely introducing multi-tenancy or unnecessary platform complexity.

## Current delivery

**Milestone 1 — Inventory Core**

The current delivery focuses on:

* Product, brand, and category management
* Supplier and customer management
* Goods receiving
* Immutable stock movements and reliable stock history
* Current stock calculation
* Basic sales records
* Basic operational reports
* Role-based access and server-side authorization

**Milestone 2 — Digital Sales Layer**

The planned second milestone adds:

* Public product catalog
* Product details and technical documents
* Quote requests
* WhatsApp handoff
* Request management

Broader capabilities such as advanced purchasing, supplier payments, customer-specific pricing, unit conversions, mobile workflows, accounting/ERP integration, multi-tenancy, and advanced CRM should only be introduced after the corresponding business need has been validated.
