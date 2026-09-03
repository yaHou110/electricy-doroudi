# Roadmap

## Milestone 1: Operational Inventory Core

### Product and master data

* Product management
* Brand management
* Category management
* Product SKU/code and stable product identity
* Product base unit of measure
* Extensible technical product attributes
* Product activation/deactivation
* Supplier master data
* Customer master data
* B2B customer profile fields where applicable

### Inventory

* Warehouse master data
* Initial/default warehouse
* Immutable stock movements
* Current stock derived from stock movements
* Warehouse-aware stock records
* Goods receiving
* Basic sales recording
* Inventory adjustments
* Stock validation and negative-stock protection
* Transaction idempotency
* Transactional inventory updates
* Basic inventory reconciliation

### Pricing

* Current purchase and sale prices
* Product price history
* Actor, timestamp, previous value, new value, and reason for price changes
* Transaction-time price snapshots so historical sales/receipts do not change when current prices change

### Customers

* Customer creation and management
* Customer types
* Company/business information
* Payment terms
* Credit limit as stored customer data
* Customer history
* Customer association with sales

### Access and security

* Authentication
* Role-based authorization
* Server-side authorization for protected operations
* Manager, warehouse, and sales roles
* Permission boundaries for sensitive inventory operations

### Reports

* Current stock by product
* Current stock by warehouse
* Stock movement history
* Receiving history
* Sales history
* Basic product/customer summaries
* Basic operational dashboards

### Technical readiness

* PostgreSQL persistence
* Prisma migrations
* Development seed data
* Automated domain tests
* Typecheck
* Lint
* Production build
* Database smoke tests
* Critical workflow verification
* Documented architecture and business rules

**Milestone 1 outcome:**
A working internal inventory and sales system that can reliably maintain product, customer, supplier, warehouse, pricing, stock, receiving, and basic sales data without requiring the future procurement or accounting modules.

---

## Milestone 2: Digital Sales Layer

### Public catalog

* Public product catalog
* Category browsing
* Product search
* Product detail pages
* Brand information
* Technical specifications
* Product images
* Technical documents where applicable
* Availability/stock visibility according to business policy

### Sales inquiry

* Quote/request form
* Product-specific inquiry
* Requested quantity
* Customer/contact information
* Request status
* Request history
* Internal request management

### Communication

* WhatsApp handoff
* Contact and inquiry actions
* Pre-filled inquiry context where appropriate
* Phone/contact actions where appropriate

### Operational connection

* Public inquiries linked to internal products
* Inquiry-to-customer association where applicable
* Sales staff workflow for handling requests
* Basic request status tracking

**Milestone 2 outcome:**
A customer-facing sales channel that exposes the product catalog and converts visitor interest into structured sales inquiries without prematurely turning the system into a full e-commerce or ERP platform.

---

## Milestone 3: Procurement and Purchasing

**Build only when the business confirms that procurement needs to be managed inside the system.**

* Supplier purchasing workflow
* Purchase orders
* Purchase order status and lifecycle
* Purchase receiving linked to purchase orders
* Purchase invoices
* Supplier payment records
* Supplier balances
* Purchase history
* Purchase price analysis
* Supplier-specific reporting
* Procurement-related permissions and approvals

**Milestone 3 outcome:**
A controlled procure-to-receive workflow connecting suppliers, purchasing, receiving, inventory, and supplier financial records.

---

## Milestone 4: Advanced B2B Commerce

**Build when real customer behavior demonstrates the need.**

* Customer-specific pricing
* Customer price lists
* Quantity-based pricing
* Tiered pricing
* Repeat orders
* Saved order templates
* Customer order history
* Credit-control workflow
* Accounts-receivable workflow where required
* Customer-specific commercial terms
* Sales quotation lifecycle
* Order lifecycle

**Milestone 4 outcome:**
A stronger B2B sales system capable of handling recurring commercial relationships rather than only individual sales and inquiries.

---

## Milestone 5: Advanced Inventory and Warehouse Operations

**Build when operational volume justifies it.**

* Multiple warehouses
* Warehouse transfers
* Storage locations/bins
* Replenishment rules
* Reorder points
* Safety stock
* Barcode workflows
* Stock reservations
* Picking and fulfillment workflows
* Returns and reversal workflows
* Advanced inventory reconciliation
* Inventory costing enhancements
* Serial/lot tracking where the product category requires it

**Milestone 5 outcome:**
A warehouse-capable inventory platform suitable for larger operational volumes and more complex stock handling.

---

## Milestone 6: Mobile and Offline Operations

**Build only after real operational workflows are stable.**

* Mobile warehouse workflows
* Mobile sales workflows
* Barcode scanning
* Receiving from mobile devices
* Stock lookup
* Offline-capable Windows client where justified
* Local data storage
* Synchronization
* Conflict handling
* Offline audit/reconciliation

**Milestone 6 outcome:**
Operational workflows that remain usable outside the primary web workstation and, where justified, under intermittent connectivity.

---

## Milestone 7: Integration and Platform Capabilities

**Build when there is a validated business requirement.**

* Accounting integration
* ERP integration
* Payment integrations
* External supplier integrations
* External sales-channel integrations
* Import/export pipelines
* Integration monitoring
* Retry and reconciliation mechanisms
* API integrations

### Multi-tenancy and white-label

* Tenant isolation
* Tenant-specific configuration
* Tenant-specific branding
* Tenant-level users and permissions
* Tenant data boundaries
* Customer-specific configuration
* Deployment and provisioning model

### Advanced CRM and automation

* Lead management
* Customer segmentation
* Follow-up workflows
* Sales automation
* Notifications
* Marketing automation
* Customer activity timeline
* Automated business rules

**Milestone 7 outcome:**
The system evolves from a single-business operational application into an extensible business platform capable of integrations, automation, and eventually multi-tenant/white-label deployment.

---

# Explicitly Deferred Until Validated

The following capabilities are intentionally not part of the initial build unless a real business requirement justifies them:

* Full accounting system
* General ledger
* Tax/accounting compliance workflows
* Full ERP replacement
* Manufacturing/MRP
* Complex CRM
* AI-driven automation
* Advanced forecasting
* Multi-company accounting
* Multi-country/currency operations
* Full e-commerce checkout and payment processing
* Complex offline synchronization
* Multi-tenancy
* White-label deployment

These items remain outside the current scope because adding them before the underlying operational need is validated would increase complexity without improving the initial product.

# Roadmap Principles

* Build the smallest complete business workflow, not the smallest number of database tables.
* Establish domain foundations before building dependent features.
* Keep future capabilities structurally possible without implementing speculative workflows.
* Do not create unused database tables merely to appear "future-ready."
* Prefer additive evolution over premature abstraction.
* Validate major workflows with real business scenarios before expanding scope.
* Each milestone should have a demonstrable business outcome.
* New scope must be evaluated against the current milestone rather than being added automatically.
* Procurement, accounting, CRM, mobile, offline synchronization, integrations, and multi-tenancy are separate domains and should not be pulled into the MVP without evidence.
* Testing, authorization, auditability, data integrity, and migration safety are part of each milestone rather than optional work after feature development.
