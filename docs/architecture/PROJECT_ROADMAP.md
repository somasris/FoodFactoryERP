# FoodFactory ERP – Official Master Development Roadmap

**Document Type:** Central Master Roadmap & Implementation Audit  
**Project:** FoodFactory ERP (Centre for Digital Infrastructure, NIT Tiruchirappalli)  
**Last Audited:** 2026-11-25  
**Target Architecture:** Client-Server Decoupled `pnpm` Monorepo (`apps/web` + `apps/api` + PostgreSQL 16+)

---

## 1. Status Taxonomy & Verification Rules

All phases and sub-phases in this roadmap use a single standardized status vocabulary:

| Status | Meaning |
| :--- | :--- |
| `NOT_STARTED` | Scope defined conceptually; no schema, API, or UI implementation exists. |
| `PLANNED` | Scheduled for a future phase; may have draft schema/design docs or UI placeholders. |
| `IN_PROGRESS` | Active implementation underway; not yet feature-complete or awaiting full verification. |
| `IMPLEMENTED` | Code is written and integrated (schema, API, and/or UI), but automated tests or verification are incomplete. |
| `TESTED` | Implemented in code AND automated unit/integration tests pass; manual UI and/or E2E workflow verification is still pending. |
| `VERIFIED` | Implemented, automated tests pass, UI manually verified, AND end-to-end business workflow verified. |
| `BLOCKED` | Progress halted due to an unresolved technical, architectural, or external dependency. |

### Evidence Distinction Policy

No module may be marked `VERIFIED` based solely on successful compilation (`tsc` / `vite build`). Documentation must distinguish between:
1. **Implemented in code**: Prisma models, Express routes/services, and React pages exist.
2. **Tests passing**: `pnpm test` (`vitest run`) passes against live PostgreSQL (`@foodfactory/api`) and `jsdom` (`@foodfactory/web`).
3. **UI manually verified**: Interactive browser walkthrough completed across desktop/tablet/mobile viewports.
4. **End-to-end workflow verified**: Full cross-module business transaction verified from start to finish with ledger and audit reconciliation.

---

## 2. Master Phase Tracking Table

| Phase | Module | Status | Dependencies | Evidence Summary |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation, Security, Master Data & Inventory | `TESTED` | None | 1.1–1.4 implemented & tested; 1.5 implemented with automated tests passing, pending manual E2E UI verification |
| **Phase 2** | Sales & Order Management | `IN_PROGRESS` | Phase 1 | Active agent implementation (`sales` module + `InventoryReservationService`); invoicing (`2.6`) not in current Phase 2 scope |
| **Phase 3** | BOM, Production & Costing | `TESTED` | Phase 1, Phase 2 | All 7 subphases (3.1–3.7) implemented, audited, and passing API E2E + Web tests (`PHASE_3_INTEGRATION_AUDIT_REPORT.md`); manual browser UI verification pending |
| **Phase 4** | System Administration, Reporting & Compliance | `TESTED` | All Core Modules | All 5 subphases (4.1–4.5) implemented, migrated, and passing API + Web test suites (`PHASE_4_INTEGRATION_VERIFICATION_REPORT.md`); manual browser UI verification pending |

---

## 3. Detailed Sub-Phase Tracking Table

| Sub-Phase | Module Name | Status | Code Implemented | Automated Tests | Manual UI / E2E Verified |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | Project Foundation *(provisional)* | `TESTED` | Yes (`apps/api`, `apps/web`, DB, `AppShell`) | Covered by build/typecheck/suite | Pending formal E2E sign-off |
| **1.2** | Core Infrastructure *(provisional)* | `TESTED` | Yes (`env.ts`, `/health`, logger, error handler) | Covered by API suite | Pending formal E2E sign-off |
| **1.3** | Authentication & RBAC | `TESTED` | Yes (`auth`, `users`, `AuditService`, `ProtectedRoute`, public `/signup` + pending approval workflow) | 43 API (`auth`, `users`, `rbac`, `signup-rbac`) + 9 Web (`auth`, `signup`) | Automated tests pass (`SIGNUP_RBAC_VERIFICATION_REPORT.md`); manual E2E UI sign-off pending |
| **1.4** | Master Data Management | `TESTED` | Yes (16 models, 15 route groups, 12 UI pages) | 5 API + 3 Web | Reported completed; E2E UI sign-off not logged |
| **1.5** | Inventory Management | `TESTED` | Yes (12 models, ledger, reservation, 9 UI pages) | 6 API (`inventory.test.ts`) + 3 Web *(46 API / 10 Web in prior stage report)* | Pending manual E2E UI verification |
| **2.1** | Sales Order Foundation | `IN_PROGRESS` | Yes (`SalesOrder`, `SalesOrderLine`, CRUD) | Covered in `sales.test.ts` (5 API) & `sales.test.tsx` (5 Web) | Pending Phase 2 completion & verification |
| **2.2** | Pricing & Taxation | `IN_PROGRESS` | Yes (GST CGST/SGST vs IGST, discounts) | Covered in `sales.test.ts` | Pending Phase 2 completion & verification |
| **2.3** | Order Lifecycle Management | `IN_PROGRESS` | Yes (Draft→Submit→Approve/Reject→Confirm→Fulfill/Cancel) | Covered in `sales.test.ts` & `sales.test.tsx` | Pending Phase 2 completion & verification |
| **2.4** | Stock Reservation | `IN_PROGRESS` | Yes (`InventoryReservationService` + `FOR UPDATE`) | Covered in `sales.test.ts` & `inventory.test.ts` | Pending Phase 2 completion & verification |
| **2.5** | Order Fulfillment | `IN_PROGRESS` | Yes (`SalesOrderFulfillment` + `InventoryIssue`) | Covered in `sales.test.ts` | Pending Phase 2 completion & verification |
| **2.6** | Sales Invoicing | `TESTED` | Yes (`SalesInvoice`, `SalesInvoiceLine`, PDFKit, UI pages) | 7 API (`sales-invoices.test.ts`) + 4 Web (`sales-invoices.test.tsx`) | Pending manual UI & E2E verification |
| **2.7** | Sales Dashboard & Reports | `IN_PROGRESS` | Yes (`GET /api/v1/sales/dashboard`, `SalesDashboardPage`) | Covered in `sales.test.tsx` | Pending Phase 2 completion & verification |
| **3.1** | BOM & Recipe Management | `TESTED` | Yes (`BOM`, `BOMVersion` yield/wastage, cost estimate, `/production/boms`) | 3 API (`bom-phase3.test.ts`) + 3 Web (`boms.test.tsx`) | Pending manual browser UI verification |
| **3.2** | Production Planning | `TESTED` | Yes (`ProductionPlan`, demand MRP, shortages, `/production/planning`) | 3 API (`production-planning.test.ts`) + 4 Web (`production-planning.test.tsx`) | Pending manual browser UI verification |
| **3.3** | Work Order Management | `TESTED` | Yes (`WorkOrder`, `WorkOrderStatusHistory`, `WorkOrderNumberSequence`, `/production/work-orders`) | 6 API (`work-orders.test.ts`) + 5 Web (`work-orders.test.tsx`) | Pending manual browser UI verification |
| **3.4** | Batch Production Execution | `TESTED` | Yes (`ProductionBatch`, consumption/output/yield, FG receipt, `/production/execution`) | 5 API (`production-batches.test.ts`) + 4 Web (`production-batches.test.tsx`) | Pending manual browser UI verification |
| **3.5** | Material Consumption & Finished Goods | `TESTED` | Yes (`ProductionBatchReturn`, `VarianceApproval`, `QualityInspection`, `/production/reconciliation`, `/production/quality`, `/production/traceability`) | 3 API (`material-fg.test.ts`) + 4 Web (`material-fg.test.tsx`) | Pending manual browser UI verification |
| **3.6** | Production Costing | `TESTED` | Yes (`ProductionBatchCosting`, `ProductionCostEntry`, `ProductionOverheadAllocation`, `ProductionCostingHistory`) | `apps/api/src/modules/production/production-costing.*` | `/production/costing/*` pages; API + Web tests passing |
| **3.7** | Production Reports | `TESTED` | Yes (`production-reports.*`, `production-reports-export.service.ts`) | 3 API (`production-reports.test.ts`) + 3 Web (`production-reports.test.tsx`) | `/production/reports/*` pages + CSV/Excel/PDF export; pending manual browser UI verification |
| **4.1** | System Administration | `TESTED` | Yes (`apps/api/src/modules/admin/*`, `AdministrationLayout`, 6 `/admin/*` pages) | 7 API (`admin-phase4-1.test.ts`) + 4 Web (`admin.test.tsx`) | Pending manual browser UI verification |
| **4.2** | Financial & Compliance Management | `TESTED` | Yes (`apps/api/src/modules/compliance/*`, `StockAudit`, `ComplianceDocument`, `/reports/compliance`, `/reports/stock-audit`) | 5 API (`compliance-phase4-2.test.ts`) + 3 Web (`compliance.test.tsx`) | Pending manual browser UI verification |
| **4.3** | Business Intelligence & Reports | `TESTED` | Yes (`apps/api/src/modules/reports/*`, `ExecutiveDashboardPage`, `BusinessIntelligencePage`) | 4 API (`reports-phase4-3.test.ts`) + 2 Web (`reports.test.tsx`) | Pending manual browser UI verification |
| **4.4** | Audit & Governance | `TESTED` | Yes (`apps/api/src/modules/governance/*`, `AuditGovernancePage`) | 4 API (`governance-phase4-4.test.ts`) + 1 Web (`governance.test.tsx`) | Pending manual browser UI verification |
| **4.5** | System Reliability & Operations | `TESTED` | Yes (`apps/api/src/modules/operations/*`, `BackupRecord`, `RestoreRequest`, `SystemHealthPage`, `BackupRecoveryPage`, `MaintenancePage`) | 4 API (`operations-phase4-5.test.ts`) + 3 Web (`operations.test.tsx`) | Pending manual browser UI verification |

> **Historical Milestone Naming Note:**  
> In the original repository history, **Phase 1.1** combined monorepo initialization, PostgreSQL setup, core infrastructure, and health checks, while **Phase 1.2** was *Database Architecture & ER Design* (`docs/database/*` — 67-model draft schema). In this master roadmap, **1.1 Project Foundation** and **1.2 Core Infrastructure** are provisional functional classifications used to organize implemented capabilities without erasing the original milestone history.

---

## 4. Phase-by-Phase Technical Specification

---

### PHASE 1 – FOUNDATION & CORE INFRASTRUCTURE

#### 1.1 Project Foundation *(Provisional Classification)*
- **Purpose:** Establish the client-server decoupled monorepo, database connectivity, and responsive UI shell.
- **Functional Scope:** `pnpm` workspace orchestration (`apps/api`, `apps/web`), TypeScript build pipelines, PostgreSQL 16+ container/local setup, Prisma ORM initialization, and responsive `AppShell` layout.
- **Key Features:**
  - Monorepo scripts (`dev`, `build`, `lint`, `format`, `typecheck`, `test`, `db:generate`, `db:migrate`).
  - Backend Express + TypeScript scaffold (`apps/api/src/app.ts`, `server.ts`).
  - Frontend React 18 + Vite + Tailwind CSS + React Router v7 + TanStack Query v5 (`apps/web/src/App.tsx`, `routes/router.tsx`).
  - Initial `SystemConfig` table (`20261124140246_init`).
- **Database Dependencies:** `SystemConfig` (`system_configs`), PostgreSQL 16+, `docker-compose.yml`.
- **Backend Dependencies:** `express`, `@prisma/client`, `cors`, `cookie-parser`.
- **Frontend Components:** `AppShell`, `Navbar`, `Sidebar`, `Footer`, `Badge`, `Button`, `Card`, `DashboardPlaceholder`, `ModulePlaceholder`, `NotFoundPage`.
- **Integration Dependencies:** Vite `/api` reverse proxy to Express `PORT=5000`.
- **Testing Requirements:** `pnpm typecheck`, `pnpm lint`, `pnpm build` succeed with 0 errors.
- **Completion Criteria:** Monorepo builds cleanly, PostgreSQL connects, and UI shell renders across desktop/mobile viewports.
- **Current Status:** `TESTED` (Implemented in commit `50473c5`; build/typecheck/lint verified; formal E2E UI sign-off not separately logged).

#### 1.2 Core Infrastructure *(Provisional Classification)*
- **Purpose:** Provide standardized environment validation, health monitoring, structured logging, uniform API responses, and centralized error handling.
- **Functional Scope:** Startup env validation, health/readiness endpoints, request latency logging, CSRF/CORS origin enforcement, and centralized exception formatting.
- **Key Features:**
  - Zod-validated environment configuration (`apps/api/src/config/env.ts`).
  - Health endpoints: `GET /api/v1/health` and `GET /api/v1/health/database` (`SELECT 1` latency check).
  - Standard JSON response envelope (`sendSuccess`, `sendError` in `apps/api/src/utils/response.ts`).
  - Global middleware (`requestLogger`, `notFoundHandler`, `errorHandler` with `AppError`, `csrf.middleware.ts`).
- **Database Dependencies:** `PrismaService` (`apps/api/src/services/prisma.service.ts`).
- **Backend Dependencies:** `zod`, `dotenv`, `express`.
- **Frontend Components:** `apiClient` (`apps/web/src/services/api-client.ts`), `health.service.ts`, `useHealth.ts`.
- **Integration Dependencies:** Consumed by all backend modules and frontend services.
- **Testing Requirements:** Health endpoints return HTTP 200 (or 503 on DB failure); CORS/CSRF policies reject unauthorized origins.
- **Completion Criteria:** Startup fails fast on invalid env; all API errors use the uniform JSON envelope.
- **Current Status:** `TESTED` (Implemented in Phase 1.1 & hardened in Phase 1.3; verified via `auth.test.ts` CSRF/CORS tests).

#### 1.3 Authentication & RBAC
- **Purpose:** Secure all ERP endpoints and routes with stateful session rotation, Argon2id password hashing, granular RBAC, and immutable audit logging.
- **Functional Scope:** User login/logout/refresh, token reuse detection, user provisioning, role assignment, warehouse facility scoping, and last-owner protection.
- **Key Features:**
  - Endpoints under `/api/v1/auth` (`login`, `refresh`, `logout`, `logout-all`, `me`) and `/api/v1/users` (list, get, create, update, roles, status, revoke-sessions).
  - Refresh token rotation with family reuse detection and HTTP-only `ff_refresh_token` cookie.
  - 5 core ERP roles (`SALESMAN`, `ADMIN`, `PRODUCTION`, `OWNER`, `AUDITOR`) with read-only enforcement for `AUDITOR`.
  - Granular permissions (`users.*`, `master_data.*`, `inventory.*`, `sales.*`, `production.*`, `bom.*`, etc.) and `UserWarehouseAccess` scoping.
  - `AuditService.log()` recording `AuditLog` entries on security and business events.
- **Database Dependencies:** `Company`, `Factory`, `Warehouse`, `User`, `Role`, `UserRole`, `Permission`, `RolePermission`, `UserWarehouseAccess`, `RefreshToken`, `AuditLog` (`20261124155931_auth_rbac_foundation`).
- **Backend Dependencies:** `argon2`, `jsonwebtoken`, `express-rate-limit`, `auth.middleware.ts`, `csrf.middleware.ts`, `AuditService`.
- **Frontend Components:** `AuthContext`, `useAuth`, `ProtectedRoute`, `LoginPage`, `UnauthorizedPage`, `apiClient` 401 silent refresh interceptor.
- **Integration Dependencies:** Protects all `/api/v1/*` domain routes and frontend `<ProtectedRoute>` wrappers.
- **Testing Requirements:** Auth, CSRF/concurrency, RBAC, and user management integration tests against PostgreSQL + frontend auth tests.
- **Completion Criteria:** All auth/RBAC tests pass; unauthenticated/unauthorized access returns 401/403; `AUDITOR` writes blocked.
- **Current Status:** `TESTED` (Previously reported completed in `docs/security/PHASE_1_3_VALIDATION_REPORT.md`; current suite passes 14 `auth.test.ts` + 12 `users.test.ts` + 9 `rbac.test.ts` = 35 API tests and 4 `auth.test.tsx` Web tests).

#### 1.4 Master Data Management
- **Purpose:** Maintain the single source of truth for products, raw materials, partners, UOM conversions, GST tax rules, warehouses, and BOM definitions.
- **Functional Scope:** CRUD and status toggling for 15 master data API resource groups and 12 frontend management views.
- **Key Features:**
  - **Products & Categories:** `ProductCategory`, `Product`, `ProductVariant` (with SKU, barcode, MRP, selling price, HSN code).
  - **Raw Materials & Categories:** `RawMaterialCategory`, `RawMaterial` (`RAW_INGREDIENT`, `PACKAGING_PRIMARY`, `PACKAGING_SECONDARY`).
  - **Unified Item Spine:** `InventoryItem` linking raw materials and product variants to inventory and BOMs.
  - **Partners:** `Supplier` + `SupplierAddress`, `Customer` + `CustomerAddress` (with GSTIN, stateCode, credit limits).
  - **UOM & Conversions:** `UnitOfMeasure` and `UnitConversion` (precise `Decimal(18,6)` factors).
  - **Tax Configuration:** `TaxRate` and `TaxConfiguration` (GST CGST/SGST/IGST rates).
  - **Facilities:** `Factory` and `Warehouse` endpoints.
  - **BOM Master Data:** `BOM`, `BOMVersion` (`DRAFT`/`ACTIVE`/`OBSOLETE`), `BOMItem`, `BOMOverhead`.
- **Database Dependencies:** 16 models added in `20261124192406_master_data_foundation`.
- **Backend Dependencies:** `apps/api/src/modules/master-data/*` mounted at `/api/v1/master-data`, `authenticate` + `requirePermissions`, `AuditService`.
- **Frontend Components:** `MasterDataLayout`, `DataTablePage`, `Modal`, `useMasterDataList`, and 12 route pages under `apps/web/src/routes/master-data/*`.
- **Integration Dependencies:** Consumed by Inventory (Phase 1.5), Sales (Phase 2), and Production (Phase 3).
- **Testing Requirements:** API integration tests for CRUD, UOM conversions, tax/BOM validation, and frontend rendering tests.
- **Completion Criteria:** All master entities persist with decimal precision, RBAC guards, and audit logs.
- **Current Status:** `TESTED` (Previously reported completed in commit `948aa1e`; current suite passes 5 `master-data.test.ts` API tests and 3 `master-data.test.tsx` Web tests; formal E2E UI verification not logged).

#### 1.5 Inventory Management
- **Purpose:** Provide transactional, multi-warehouse stock control with batch/expiry traceability, FEFO/FIFO picking, MWAC valuation, and an immutable ledger.
- **Functional Scope:** Stock balances, receipts, issues, inter-warehouse transfers, stock adjustments, batch/expiry tracking, valuation history, and transaction reversals.
- **Key Features:**
  - **Stock Balances & Batches:** `InventoryBalance` (on-hand & reserved per warehouse/batch) and `InventoryBatch` (batch number, manufacturing/expiry dates, unit cost).
  - **Document Workflows:** `InventoryReceipt`, `InventoryIssue`, `InventoryTransfer` (DRAFT→APPROVED→IN_TRANSIT→RECEIVED), `InventoryAdjustment` (with `AdjustmentReason`).
  - **Immutable Ledger:** `InventoryTransaction` + `InventoryTransactionLine` (append-only IN/OUT movements with `balanceBefore`/`balanceAfter`) and reversal support.
  - **Concurrency & Valuation:** `SELECT ... FOR UPDATE` row locking; Moving Weighted Average Cost (MWAC) updates; FEFO/FIFO picking strategy.
  - **Reservation Engine:** `InventoryReservationService` (`reserveStockInTx`, release, fulfill) for downstream Sales/Production.
- **Database Dependencies:** 12 models added in `20261124202451_inventory_management_foundation`.
- **Backend Dependencies:** `apps/api/src/modules/inventory/*` mounted at `/api/v1/inventory`, `AuditService`, `UnitConversion`.
- **Frontend Components:** `InventoryLayout`, `InventoryStatusBadge`, and 9 pages (`InventoryDashboardPage`, `StockBalancesPage`, `InventoryReceiptsPage`, `InventoryIssuesPage`, `WarehouseTransfersPage`, `StockAdjustmentsPage`, `BatchExpiryPage`, `InventoryValuationPage`, `InventoryTransactionsPage`).
- **Integration Dependencies:** Depends on Master Data (`InventoryItem`, `Warehouse`, `UnitOfMeasure`); consumed by Sales (`InventoryReservationService`) and future Production.
- **Testing Requirements:** Concurrency/locking tests, MWAC valuation tests, FEFO/FIFO picking tests, reversal tests, and UI tests.
- **Completion Criteria:** All API and UI tests pass, ledger balances reconcile 100% with `InventoryBalance`, and manual E2E UI workflow is verified.
- **Current Status:** `TESTED` (Implemented in commit `bd72351`; previously reported with 46 API tests and 10 frontend tests passing; current `pnpm test` passes 6 tests in `inventory.test.ts` and 3 tests in `inventory.test.tsx`; **manual end-to-end UI workflow verification remains pending**).

---

### PHASE 2 – SALES & ORDER MANAGEMENT

> [!IMPORTANT]
> **Active Implementation Notice & Scope Difference:**  
> Phase 2 is currently being handled by an active Antigravity agent (commit `49d80e4`, migration `20261125053259_sales_orders_phase_2`).  
> **Scope Difference Observed:** The proposed Phase 2 structure includes **2.6 Sales Invoicing**. However, the actual Phase 2 implementation in `schema.prisma`, `sales.routes.ts`, and `apps/web/src/routes/sales/*` implements **2.1–2.5 and 2.7** (Sales Orders, GST Pricing, Order Lifecycle, Stock Reservation, Fulfillment, and Sales Dashboard). **Sales Invoicing (`SalesInvoice`, `InvoiceTaxBreakdown`, `Dispatch`, `Payment`, `PaymentAllocation`) is NOT implemented in Phase 2** and remains in `docs/database/prisma-schema-draft.prisma`.

#### 2.1 Sales Order Foundation
- **Purpose:** Enable salesmen and administrators to create, edit, and view customer sales orders linked to master data and warehouses.
- **Functional Scope:** Order header (`SalesOrder`) and line items (`SalesOrderLine`), customer/shipping address selection, warehouse assignment, and order listing/detail views.
- **Key Features:** Auto-generated order numbers, customer order history (`GET /api/v1/sales/customers/:customerId/orders`), draft editing (`PATCH /api/v1/sales/orders/:id`).
- **Database Dependencies:** `SalesOrder`, `SalesOrderLine` (`20261125053259_sales_orders_phase_2`), `Customer`, `CustomerAddress`, `ProductVariant`, `Warehouse`, `UnitOfMeasure`.
- **Backend Dependencies:** `apps/api/src/modules/sales/*` mounted at `/api/v1/sales`.
- **Frontend Components:** `SalesLayout`, `SalesOrdersPage`, `SalesOrderFormPage`, `SalesOrderDetailPage`, `SalesStatusBadge`.
- **Integration Dependencies:** Phase 1.3 (RBAC `sales.orders.*`), Phase 1.4 (Customers, Products, Warehouses, UOMs).
- **Testing Requirements:** CRUD validation, RBAC permission checks, and UI form/list rendering tests.
- **Completion Criteria:** Orders can be created, updated in draft/rejected states, and viewed with line-level details.
- **Current Status:** `IN_PROGRESS` (Code implemented in `49d80e4`; automated tests in `sales.test.ts` and `sales.test.tsx` passing; awaiting final Phase 2 sign-off).

#### 2.2 Pricing & Taxation
- **Purpose:** Compute accurate line totals, discounts, and GST tax splits (CGST+SGST vs IGST) using Decimal precision.
- **Functional Scope:** Unit price resolution from `ProductVariant`, line discount percentage (`0–100%`), and automatic intra-state vs inter-state GST calculation.
- **Key Features:** `Company.stateCode` vs `Customer.stateCode` comparison, `TaxConfiguration`/`TaxRate` lookup, `Decimal(14,2)` tax and total amounts.
- **Database Dependencies:** `SalesOrderLine` (`unitPrice`, `discountPercent`, `cgstRate`, `sgstRate`, `igstRate`, `taxAmount`, `lineTotal`), `Company`, `Customer`, `TaxRate`, `TaxConfiguration`.
- **Backend Dependencies:** `SalesService` pricing/tax calculation helpers.
- **Frontend Components:** `SalesOrderFormPage` (live pricing/tax preview), `SalesOrderDetailPage`.
- **Integration Dependencies:** Phase 1.4 Tax Configuration and Customer/Company state codes.
- **Testing Requirements:** Intra-state (CGST+SGST) and inter-state (IGST) calculation tests; discount edge cases.
- **Completion Criteria:** Zero floating-point drift; tax breakdowns match GST rules.
- **Current Status:** `IN_PROGRESS` (Implemented in `49d80e4`; awaiting final Phase 2 verification).

#### 2.3 Order Lifecycle Management
- **Purpose:** Enforce governed state transitions from draft to approval, confirmation, fulfillment, or cancellation with full status history.
- **Functional Scope:** `DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED` → `CONFIRMED` → `PARTIALLY_FULFILLED` / `FULFILLED` or `CANCELLED`.
- **Key Features:** Dedicated endpoints (`/submit`, `/approve`, `/reject`, `/confirm`, `/cancel`), mandatory rejection/cancellation reasons, `SalesOrderStatusHistory` audit trail.
- **Database Dependencies:** `SalesOrderStatus` enum, `SalesOrderStatusHistory`.
- **Backend Dependencies:** `SalesController`, `SalesService`, `AuditService`.
- **Frontend Components:** `PendingApprovalsPage`, `SalesOrderDetailPage` action buttons, `SalesStatusBadge`.
- **Integration Dependencies:** Phase 1.3 RBAC (`sales.orders.submit`, `approve`, `reject`, `confirm`, `cancel`) and `AuditService`.
- **Testing Requirements:** Valid/invalid state transition tests, role authorization tests, and status history logging.
- **Completion Criteria:** Invalid transitions are rejected; every transition records user, timestamp, and remarks.
- **Current Status:** `IN_PROGRESS` (Implemented in `49d80e4`; awaiting final Phase 2 verification).

#### 2.4 Stock Reservation
- **Purpose:** Prevent overselling by atomically reserving finished goods stock upon order confirmation and releasing it on cancellation.
- **Functional Scope:** Pessimistic row-locked reservation (`quantityReserved`) across non-expired warehouse batches using FEFO/FIFO ordering.
- **Key Features:** Idempotent confirmation (`idempotencyKey`), shortage detection (HTTP 409 on insufficient available stock), automatic reservation release on order cancellation.
- **Database Dependencies:** `InventoryBalance.quantityReserved`, `InventoryBatch`, `SalesOrder.idempotencyKey`.
- **Backend Dependencies:** `InventoryReservationService.reserveStockInTx` and release methods.
- **Frontend Components:** `SalesOrderDetailPage` (confirmation & shortage feedback).
- **Integration Dependencies:** Phase 1.5 `InventoryReservationService` and `InventoryBalance`.
- **Testing Requirements:** Concurrent confirmation tests, expired batch exclusion, and cancellation release tests.
- **Completion Criteria:** Concurrent confirmations cannot oversell available stock; cancellation restores `available = onHand - reserved`.
- **Current Status:** `IN_PROGRESS` (Implemented in `49d80e4`; awaiting final Phase 2 verification).

#### 2.5 Order Fulfillment
- **Purpose:** Fulfill confirmed sales orders (fully or partially) by posting inventory issues and updating order/line fulfillment quantities.
- **Functional Scope:** Partial or full line fulfillment (`POST /api/v1/sales/orders/:id/fulfill`), `SalesOrderFulfillment` tracking, and `InventoryIssue` / ledger posting.
- **Key Features:** Idempotent fulfillment (`idempotencyKey`), automatic transition to `PARTIALLY_FULFILLED` or `FULFILLED`, immutable `InventoryTransaction` linkage.
- **Database Dependencies:** `SalesOrderFulfillment`, `SalesOrderLine.fulfilledQuantity`, `InventoryIssue`, `InventoryTransaction`.
- **Backend Dependencies:** `SalesService.fulfillOrder`, `InventoryReservationService`, `AuditService`.
- **Frontend Components:** `OrderFulfillmentPage`, `SalesOrderDetailPage`.
- **Integration Dependencies:** Phase 1.5 Inventory Issue & Transaction Ledger.
- **Testing Requirements:** Partial fulfillment, over-fulfillment rejection, and ledger balance reconciliation tests.
- **Completion Criteria:** Fulfilled quantities accurately deduct `quantityOnHand` and `quantityReserved` and post immutable ledger lines.
- **Current Status:** `IN_PROGRESS` (Implemented in `49d80e4`; awaiting final Phase 2 verification).

#### 2.6 Sales Invoicing
- **Purpose:** Generate GST-compliant tax invoices, sequential financial-year invoice numbers, and downloadable PDF tax invoices from fulfilled or partially fulfilled sales orders.
- **Functional Scope:** `SalesInvoice`, `SalesInvoiceLine`, `SalesInvoiceStatusHistory`, `InvoiceNumberSequence`, GST CGST/SGST vs IGST calculation, rupee round-off, PDFKit rendering, and frontend invoice workflows.
- **Key Features:** Immutable company/customer/tax snapshots, concurrency-safe FY numbering (`INV/YYYY-YY/NNNNN`), `invoicedBaseQuantity` tracking preventing over-invoicing or duplicate invoicing, draft editing, `ISSUED` locking, `CANCELLED` with mandatory reason (without inventory reversal), and authenticated PDF download.
- **Database Dependencies:** `SalesInvoice`, `SalesInvoiceLine`, `SalesInvoiceStatusHistory`, `InvoiceNumberSequence`, `SalesOrderLine.invoicedBaseQuantity` (`20261125055717_sales_invoicing_phase_2_6`).
- **Backend Dependencies:** `sales-invoice.service.ts`, `sales-invoice-pdf.service.ts`, `sales-invoice.controller.ts`, `sales.routes.ts`, `AuditService`.
- **Frontend Components:** `SalesInvoicesPage`, `SalesInvoiceDetailPage`, `SalesInvoiceFormPage`, `SalesDashboardPage` (invoice metrics), `SalesOrderDetailPage` ("Create Invoice" action).
- **Integration Dependencies:** Phase 2.5 Order Fulfillment (`fulfilledBaseQuantity`), Phase 1.4 Tax/Customer/Company Master Data, Phase 1.3 RBAC (`sales.invoices.*`).
- **Testing Requirements:** GST CGST/SGST & IGST math, partial/multiple fulfillment invoicing, concurrent numbering, snapshot preservation, lifecycle transitions, RBAC, and PDF generation tests.
- **Completion Criteria:** Invoices post with immutable GST snapshots, prevent duplicate/over-invoicing, generate valid PDFs, and pass manual UI verification.
- **Current Status:** `TESTED` (Implemented with 7 API integration tests in `sales-invoices.test.ts` and 4 frontend tests in `sales-invoices.test.tsx` passing; manual UI & E2E verification pending). Note: `SalesReturn`, `CreditNote`, and `Payment`/`PaymentAllocation` remain out of scope for Phase 2.6.

#### 2.7 Sales Dashboard & Reports
- **Purpose:** Provide real-time visibility into order volumes, revenue summaries, pending approvals, and fulfillment backlogs.
- **Functional Scope:** Aggregated sales KPIs (`GET /api/v1/sales/dashboard`) and dashboard UI.
- **Key Features:** Order counts by status, total order value, pending approval queue, and fulfillment status overview.
- **Database Dependencies:** `SalesOrder`, `SalesOrderLine`.
- **Backend Dependencies:** `SalesController.dashboard`, `requirePermissions('sales.dashboard.read')`.
- **Frontend Components:** `SalesDashboardPage`.
- **Integration Dependencies:** Phase 2.1–2.5 Sales Order data.
- **Testing Requirements:** Dashboard aggregation accuracy and permission guard tests.
- **Completion Criteria:** Dashboard reflects live database state with zero mock data.
- **Current Status:** `IN_PROGRESS` (Implemented in `49d80e4`; awaiting final Phase 2 verification).

---

### PHASE 3 – BOM, PRODUCTION & COSTING

#### 3.1 BOM & Recipe Management
- **Purpose:** Govern standardized food recipes, multi-level ingredient/packaging ratios, version locking, and standard overheads.
- **Functional Scope:** BOM headers, active/obsolete versioning (`BOMVersion`), raw material/packaging line items (`BOMItem`), and standard overheads (`BOMOverhead`).
- **Key Features:** Version activation/obsolescence, historical version locking on production runs, UOM conversion support.
- **Database Dependencies:** `BOM`, `BOMVersion`, `BOMItem`, `BOMOverhead` (already in `schema.prisma` from Phase 1.4).
- **Backend Dependencies:** `apps/api/src/modules/master-data/boms/*` (CRUD/versioning exists); production recipe explosion service pending.
- **Frontend Components:** `BomsPage` (exists in Master Data); production-floor recipe view pending.
- **Integration Dependencies:** Phase 1.4 Raw Materials, Products, UOMs.
- **Testing Requirements:** BOM version locking and recipe quantity explosion tests.
- **Completion Criteria:** Active BOM versions can be exploded into exact material requirements for any batch size.
- **Current Status:** `TESTED` (Implemented with `yieldPercentage`/`expectedWastagePercent`, UOM conversion validation, Decimal cost estimation & recipe explosion, explicit `obsolete` lifecycle, audit history, `/production/boms` UI, 3 API tests in `bom-phase3.test.ts`, and 3 frontend tests in `boms.test.tsx` passing; manual browser UI verification pending).

#### 3.2 Production Planning
- **Purpose:** Schedule manufacturing batches based on confirmed sales orders, reorder levels, and factory capacity.
- **Functional Scope:** `ProductionOrder` creation, target output scheduling, material availability checks against `InventoryBalance`.
- **Key Features:** Link sales demand to production orders, shortage alerts for raw ingredients/pouches.
- **Database Dependencies:** `ProductionOrder` (draft schema).
- **Backend Dependencies:** `apps/api/src/modules/production/` (currently `.gitkeep` placeholder).
- **Frontend Components:** `/production` (currently `ModulePlaceholder`).
- **Integration Dependencies:** Phase 1.5 Inventory Balances, Phase 2 Sales Orders, Phase 3.1 BOM.
- **Testing Requirements:** Material availability calculation and scheduling validation tests.
- **Completion Criteria:** Production orders reserve/check required raw materials and schedule target batches.
- **Current Status:** `TESTED` (Implemented with `ProductionPlan` models, demand MRP, BOM yield/UOM explosion, read-only material availability, `DRAFT→SUBMITTED→APPROVED/REJECTED→RELEASED/CANCELLED` lifecycle, RBAC, frontend pages, 3 API tests, and 4 frontend tests passing; manual browser UI verification pending).

#### 3.3 Work Order Management
- **Purpose:** Issue, schedule, approve, release, and cancel shop-floor work orders against `APPROVED`/`RELEASED` production plans.
- **Functional Scope:** `WorkOrder` lifecycle (`DRAFT` → `SUBMITTED` → `APPROVED`/`REJECTED` → `RELEASED` → `CANCELLED`, with `IN_PROGRESS`/`COMPLETED` reserved for Phase 3.4), partial allocation/splitting against `ProductionPlanItem.workOrderedQuantity`, FY-aware numbering (`WO/YYYY-YY/00001`).
- **Key Features:** Atomic `SELECT ... FOR UPDATE` plan allocation, locked `bomId`/`bomVersionId`, read-only BOM material requirements & shortage visibility, schedule conflict detection, `AuditService` & status history tracking.
- **Database Dependencies:** `WorkOrder`, `WorkOrderStatusHistory`, `WorkOrderNumberSequence`, `ProductionPlanItem.workOrderedQuantity`.
- **Backend Dependencies:** `apps/api/src/modules/production/work-order.{service,controller,types}.ts`.
- **Frontend Components:** `/production/work-orders`, `/production/work-orders/dashboard`, `/production/work-orders/:id`, `/production/plans/:planId/work-orders/new`.
- **Integration Dependencies:** Phase 3.1 BOM, Phase 3.2 Production Planning.
- **Testing Requirements:** Work order state machine, concurrency, read-only inventory invariant, schedule conflicts, and RBAC (`PRODUCTION`, `ADMIN`, `OWNER`, `AUDITOR`, `SALESMAN`) tests.
- **Completion Criteria:** Work orders enforce valid lifecycle transitions and lock recipe versions.
- **Current Status:** `TESTED` (Implemented with `WorkOrder` models, `WO/YYYY-YY/00001` numbering, partial allocation, read-only material requirements, schedule conflict warnings, RBAC, frontend pages, 6 API tests, and 5 frontend tests passing; manual browser UI verification pending; see [PHASE_3_3_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_3_3_VERIFICATION_REPORT.md)).

#### 3.4 Batch Production Execution
- **Purpose:** Execute released work orders on the shop floor via production batches, recording material consumption, good output, rejections, wastage, yield, and finished-goods inventory receipts.
- **Functional Scope:** `ProductionBatch` lifecycle (`CREATED` → `IN_PROGRESS` → `PAUSED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`), FY-aware batch numbering (`PB/YYYY-YY/00001`), multi-batch partial execution per work order.
- **Key Features:** Transactional material reservation & idempotent BOM material consumption (`InventoryIssue` + `InventoryTransaction`), Decimal yield/completion calculation, idempotent finished-goods `InventoryBatch` + `InventoryReceipt` + MWAC valuation, full RM-to-FG traceability.
- **Database Dependencies:** `ProductionBatch`, `ProductionBatchConsumption`, `ProductionBatchStatusHistory`, `ProductionExecutionEntry`, `ProductionBatchNumberSequence`, `WorkOrder.allocatedBatchQuantity`.
- **Backend Dependencies:** `apps/api/src/modules/production/production-batch.{service,controller,types}.ts`.
- **Frontend Components:** `/production/execution`, `/production/batches`, `/production/batches/:id`.
- **Integration Dependencies:** Phase 3.3 Work Orders, Inventory Reservation/Issue/Receipt ledger.
- **Testing Requirements:** Batch lifecycle, concurrency, material consumption & UOM/stock validation, idempotency, yield/wastage, FG receipt, and RBAC tests.
- **Completion Criteria:** Good output and scrap quantities reconcile with consumed ingredients and post atomically to the inventory ledger.
- **Current Status:** `TESTED` (Implemented with `ProductionBatch` models, `PB/YYYY-YY/00001` numbering, idempotent material consumption & FG receipt, yield/wastage tracking, RBAC, frontend execution pages, 5 API tests, and 4 frontend tests passing; manual browser UI verification pending; see [PHASE_3_4_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_3_4_VERIFICATION_REPORT.md)).

#### 3.5 Material Consumption & Finished Goods
- **Purpose:** Reconcile planned vs actual material consumption, handle controlled material returns and excess variance approvals, enforce finished-goods quality inspection & quarantine release before saleable availability, and provide bidirectional batch genealogy/recall lookup.
- **Functional Scope:** Material consumption reconciliation, `ProductionBatchReturn`, `ProductionBatchVarianceApproval`, `QualityInspection` (`PENDING`, `ACCEPTED`, `PARTIALLY_ACCEPTED`, `QUARANTINED`, `REJECTED`), `InventoryBatch.qualityStatus` gating on sales/issues, `ProductVariant.shelfLifeDays`, and recall lookup.
- **Key Features:** Transactional, idempotent material returns (`InventoryReceipt` + `InventoryTransaction`), configurable variance thresholds (`PRODUCTION_VARIANCE_THRESHOLD_PERCENT`), sales/reservation exclusion of uninspected/quarantined/rejected batches, ledger-balanced partial acceptance split (`-REJ` batch).
- **Database Dependencies:** `ProductionBatchReturn`, `ProductionBatchVarianceApproval`, `QualityInspection`, `InventoryBatch.qualityStatus`, `ProductVariant.shelfLifeDays`.
- **Backend Dependencies:** `apps/api/src/modules/production/material-fg.{service,controller,types}.ts`, `InventoryReservationService`, `InventoryIssueService`.
- **Frontend Components:** `/production/reconciliation`, `/production/quality`, `/production/traceability`.
- **Integration Dependencies:** Phase 3.4 Batch Execution, Phase 1.5 Inventory Ledger, Phase 2 Sales Reservation.
- **Testing Requirements:** Reconciliation math, partial/expired/idempotent returns, variance approval RBAC, quality inspection & quarantine exclusion from Sales Orders, partial acceptance split, and recall lookup tests.
- **Completion Criteria:** Quarantined/pending/rejected finished goods cannot be sold; every return and quality split posts balanced `InventoryTransaction`s.
- **Current Status:** `TESTED` (Implemented with reconciliation, returns, variance approvals, quality inspections, quarantine gating, shelf-life, recall lookup, RBAC, frontend pages, 3 API tests, and 4 frontend tests passing; manual browser UI verification pending; see [PHASE_3_5_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_3_5_VERIFICATION_REPORT.md)).

#### 3.6 Production Costing
- **Purpose:** Compute true batch production cost and unit cost per accepted good unit by combining net material cost, labour, machine, and allocated overheads.
- **Functional Scope:** `ProductionBatchCosting` (`DRAFT` → `CALCULATED` → `REVIEWED` → `FINALIZED`), `ProductionCostEntry` (`DIRECT_LABOUR`, `MACHINE_COST`, `OTHER_DIRECT_EXPENSE`), `ProductionOverheadAllocation` (`PER_BATCH`, `PER_UNIT`, `PERCENT_OF_MATERIAL`, `PER_LABOUR_HOUR`), `ProductionCostingHistory`, and FG MWAC revaluation.
- **Key Features:** Exact `Prisma.Decimal` calculation, historical transaction material costing with return deductions, wastage/rejection cost separation, safe zero-output handling, variance analysis, idempotent FG valuation integration, and RBAC (`OWNER`, `ADMIN`, `PRODUCTION`, `AUDITOR`).
- **Database Dependencies:** `ProductionBatchCosting`, `ProductionCostEntry`, `ProductionOverheadAllocation`, `ProductionCostingHistory` (`20261125083914_production_costing_phase_3_6`).
- **Backend Dependencies:** `apps/api/src/modules/production/production-costing.{types,service,controller}.ts`.
- **Frontend Components:** `/production/costing`, `/production/costing/batches/:batchId`, `/production/costing/variance-report`.
- **Integration Dependencies:** Phase 3.4 Batch Execution, Phase 3.5 Material Returns & Quality Inspection, Inventory MWAC Ledger.
- **Testing Requirements:** Material/return/labour/machine/overhead/variance math, zero accepted output, immutability, FG valuation, and RBAC tests.
- **Completion Criteria:** Unit production cost blends accurately into finished goods warehouse MWAC without double-counting.
- **Current Status:** `TESTED` (Implemented with schema/migration, Decimal costing service, RBAC, frontend pages, 2 API tests in `test/production-costing.test.ts`, and 3 frontend tests in `src/test/production-costing.test.tsx` passing; manual browser UI verification pending; see [PHASE_3_6_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_3_6_VERIFICATION_REPORT.md)).

#### 3.7 Production Reports
- **Purpose:** Surface production KPIs, plan vs actual, work order performance, batch yield, material consumption/wastage, quality, costing variance, and time-series trends for `PRODUCTION`, `OWNER`, `ADMIN`, and `AUDITOR` roles.
- **Functional Scope:** Read-only analytics dashboard, 6 operational & costing reports, daily/weekly/monthly trends, and CSV/Excel/PDF exports.
- **Key Features:** Read-only endpoints under `/api/v1/production/reports/*`, Indian FY date boundaries, `Prisma.Decimal` precision, granular RBAC (`production.reports.costing.read` separated from operational `production.reports.read`).
- **Database Dependencies:** Reuses Phase 3.1–3.6 tables (`ProductionPlan`, `WorkOrder`, `ProductionBatch`, `ProductionBatchConsumption`, `ProductionBatchReturn`, `QualityInspection`, `ProductionBatchCosting`).
- **Backend Dependencies:** `apps/api/src/modules/production/production-reports.{types,service,controller}.ts`, `production-reports-export.service.ts`.
- **Frontend Components:** `/production/reports`, `/production/reports/{plan-vs-actual,work-order-performance,batch-yield,material-consumption,quality,costing}`.
- **Integration Dependencies:** Phase 3.4–3.6 Production & Costing data.
- **Testing Requirements:** KPI/report accuracy, RBAC isolation, export formats, and read-only guarantees.
- **Completion Criteria:** Reports match underlying ledger and production records with zero mock data.
- **Current Status:** `TESTED` (Implemented with 9 read-only endpoints, CSV/Excel/PDF export, RBAC, 7 frontend pages + trend charts, 3 API tests in `test/production-reports.test.ts`, and 3 frontend tests in `src/test/production-reports.test.tsx` passing; manual browser UI verification pending; see [PHASE_3_7_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_3_7_VERIFICATION_REPORT.md)).

---

### PHASE 4 – SYSTEM ADMINISTRATION, REPORTING & COMPLIANCE

#### 4.1 System Administration
- **Purpose:** Provide a dedicated administrative UI and management controls for users, roles, permissions, warehouse access, and system configuration.
- **Functional Scope:** Frontend administration console for `/api/v1/users` and `SystemConfig` management.
- **Key Features:** User provisioning UI, role assignment matrix, user deactivation/session revocation, warehouse access assignment.
- **Database Dependencies:** `User`, `Role`, `Permission`, `UserWarehouseAccess`, `SystemConfig` (already in `schema.prisma`).
- **Backend Dependencies:** `/api/v1/users` (implemented in 1.3); `SystemConfig` admin endpoints pending.
- **Frontend Components:** `/admin` (currently `ModulePlaceholder` in `router.tsx`).
- **Integration Dependencies:** Phase 1.3 Auth & RBAC.
- **Testing Requirements:** Admin UI workflows, last-owner protection UI handling, and RBAC guards (`ADMIN`, `OWNER`).
- **Completion Criteria:** All user/role/facility administration tasks can be performed through `/admin` without direct DB access.
- **Current Status:** `TESTED` (Implemented with migration `20261125121620_system_administration_phase_4_1`, `/api/v1/admin/*`, `AdministrationLayout`, 6 UI pages, 7 API tests, and 4 frontend tests passing; manual browser UI verification pending; see [PHASE_4_1_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_4_1_VERIFICATION_REPORT.md)).

#### 4.2 Financial & Compliance Management
- **Purpose:** Deliver GST compliance (GSTR-1, GSTR-3B), purchase/supplier billing, payment collections/disbursements, and expense tracking.
- **Functional Scope:** `PurchaseOrder`, `GoodsReceipt`, `SupplierInvoice`, `Payment`, `PaymentAllocation`, `ExpenseCategory`, `Expense`, and GST tax ledgers.
- **Key Features:** Supplier invoice matching, customer/supplier payment allocation with row locking, GST outward/inward tax summaries.
- **Database Dependencies:** Procurement, Invoicing, and Payments/Expenses models in `docs/database/prisma-schema-draft.prisma`.
- **Backend Dependencies:** New/expanded modules for procurement, invoicing, payments, and compliance.
- **Frontend Components:** Financial & GST compliance views under `/reports` or dedicated sub-routes.
- **Integration Dependencies:** Phase 1.4 Tax/Suppliers/Customers, Phase 1.5 Inventory Receipts, Phase 2 Sales Orders.
- **Testing Requirements:** GST split accuracy, payment allocation invariants, and `AUDITOR` read-only enforcement.
- **Completion Criteria:** Statutory GST reports and payment ledgers reconcile 100% with invoices and transactions.
- **Current Status:** `TESTED` (Implemented with migration `20261125123652_financial_compliance_phase_4_2`, GST/HSN invoice snapshot summaries, honest purchase tax unavailability reporting, inventory valuation & ledger-backed `StockAudit` workflow, production cost compliance, traceability, CSV/Excel/PDF exports, `ComplianceDocument` metadata registry, 5 API tests, and 3 frontend tests passing; manual browser UI verification pending; see [PHASE_4_2_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_4_2_VERIFICATION_REPORT.md)).

#### 4.3 Business Intelligence & Reports
- **Purpose:** Provide executive dashboards for profitability margins, SKU contribution, inventory aging, and operational KPIs.
- **Functional Scope:** Cross-module analytics aggregating Sales, Production Costing, and Inventory Valuation.
- **Key Features:** Gross profit per SKU, COGS vs revenue trends, slow-moving/expiring stock alerts, exportable audit reports.
- **Database Dependencies:** Read-only queries across `SalesOrder`, `InventoryTransactionLine`, `ProductionRun`, `Expense`.
- **Backend Dependencies:** `apps/api/src/modules/reports/` (placeholder).
- **Frontend Components:** `/reports` (`ModulePlaceholder`).
- **Integration Dependencies:** Phase 1.5, Phase 2, Phase 3, Phase 4.2.
- **Testing Requirements:** Query performance, RBAC (`OWNER`, `ADMIN`, `AUDITOR`), and calculation accuracy tests.
- **Completion Criteria:** Executive KPIs reconcile with transactional tables.
- **Current Status:** `TESTED` (Implemented with `/api/v1/reports/*` executive dashboard, sales/inventory/production/profitability/factory analytics, CSV/Excel/PDF exports, 4 API tests, and 2 frontend tests passing; manual browser UI verification pending; see [PHASE_4_3_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_4_3_VERIFICATION_REPORT.md)).

#### 4.4 Audit & Governance
- **Purpose:** Expose immutable security and operational audit trails for compliance inspection by `ADMIN`, `OWNER`, and `AUDITOR`.
- **Functional Scope:** Audit log query API (`audit.read` permission) and frontend Audit Log Explorer with filtering by user, entity, action, and date range.
- **Key Features:** Before/after JSON state diff viewer, security alert highlighting (`LOGIN_FAILED`, `SECURITY_ALERT`, token reuse).
- **Database Dependencies:** `AuditLog` (already in `schema.prisma`).
- **Backend Dependencies:** `AuditService` (write path active since 1.3); read/filter API endpoints pending.
- **Frontend Components:** Audit viewer inside `/admin` or `/reports`.
- **Integration Dependencies:** All modules writing to `AuditService`.
- **Testing Requirements:** Immutable read-only access tests, filter accuracy, and `AUDITOR` access verification.
- **Completion Criteria:** Auditors can inspect end-to-end entity histories across all modules via UI.
- **Current Status:** `TESTED` (Implemented with `/api/v1/governance/*` append-only audit explorer, field-level diffs, sensitive field redaction, cross-module approval governance, user activity monitoring, unified transaction history, CSV export, 4 API tests, and 1 frontend test passing; manual browser UI verification pending; see [PHASE_4_4_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_4_4_VERIFICATION_REPORT.md)).

#### 4.5 System Reliability & Operations
- **Purpose:** Ensure production readiness with automated backups, migration safety runbooks, rate-limiting hardening, and operational monitoring.
- **Functional Scope:** PostgreSQL backup/restore procedures, health/readiness probes, log retention, and deployment checklists.
- **Key Features:** Automated DB backup scripts, structured production logging, environment hardening verification.
- **Database Dependencies:** PostgreSQL 16+ operational tooling.
- **Backend Dependencies:** Health endpoints (`/api/v1/health`, `/api/v1/health/database`), graceful shutdown (`server.ts`).
- **Frontend Components:** System status indicators.
- **Integration Dependencies:** Docker Compose / host infrastructure.
- **Testing Requirements:** Backup/restore drill, graceful shutdown verification, and load/concurrency smoke checks.
- **Completion Criteria:** Documented operational runbooks and verified recovery procedures.
- **Current Status:** `TESTED` (Implemented with migration `20261125131455_operations_reliability_phase_4_5`, `/api/v1/operations/*`, `TelemetryStore`, `maintenanceMiddleware`, `DISASTER_RECOVERY_RUNBOOK.md`, 3 UI pages, 4 API tests, and 3 frontend tests passing; manual browser UI verification pending; see [PHASE_4_5_VERIFICATION_REPORT.md](file:///d:/somasri/projects/FoodFactoryERP/docs/verification/PHASE_4_5_VERIFICATION_REPORT.md)).

---

## 5. Architectural Dependency Map

> For a detailed module matrix and data-flow diagram, see [PHASE_DEPENDENCY_MAP.md](file:///d:/somasri/projects/FoodFactoryERP/docs/architecture/PHASE_DEPENDENCY_MAP.md).

Core architectural dependencies verified in the repository:
1. **Authentication & RBAC (1.3)** protect every domain API router (`masterDataRouter`, `inventoryRouter`, `salesRouter`) via `authenticate` and `requirePermissions`, and protect frontend routes via `ProtectedRoute`.
2. **Master Data (1.4)** provides `Customer`, `Product`, `ProductVariant`, `RawMaterial`, `Supplier`, `InventoryItem`, `UnitOfMeasure`/`UnitConversion`, `TaxRate`/`TaxConfiguration`, `Warehouse`, and `BOM` definitions consumed by all transactional modules.
3. **Inventory (1.5)** owns `InventoryBalance`, `InventoryBatch`, receipts, issues, transfers, adjustments, MWAC valuation, and the immutable `InventoryTransaction`/`InventoryTransactionLine` ledger.
4. **Sales & Orders (Phase 2)** depends on Master Data (`Customer`, `ProductVariant`, `TaxConfiguration`, `Warehouse`) and Inventory (`InventoryReservationService` for atomic `SELECT ... FOR UPDATE` stock reservation and `InventoryIssue` ledger posting on fulfillment).
5. **BOM & Production (Phase 3)** will depend on Master Data (`BOM`, `BOMVersion`, `RawMaterial`, `ProductVariant`), Inventory (raw material/packaging issues and finished goods `PRODUCTION_RECEIPT` with MWAC blending), and Sales Orders (demand planning).
6. **Costing & Reports (Phase 3.6–3.7, Phase 4.3)** will aggregate Production consumption/overheads, Inventory valuation, and Sales revenue/COGS.
7. **AuditService (`apps/api/src/services/audit.service.ts`)** provides cross-cutting immutable traceability into `audit_logs` across Auth, Users, Master Data, Inventory, and Sales without crashing host transactions on log write errors.

---

## 6. End-to-End Business Workflow

The target FoodFactory ERP manufacturing-to-cash lifecycle connects modules as follows:

```
Customer Order
  → Sales Order (Phase 2.1–2.3: DRAFT → SUBMITTED → APPROVED → CONFIRMED)
  → Production Planning (Phase 3.2: Check FG stock; schedule ProductionOrder if short)
  → BOM & Recipe (Phase 3.1: Lock active BOMVersion & explode ingredient/packaging qty)
  → Work Order (Phase 3.3: Create ProductionRun with unique batchNumber)
  → Batch Production (Phase 3.4: Execute mixing/frying/packing; log ProductionScrap)
  → Raw Material Consumption (Phase 3.5: MaterialIssue → Inventory OUT ledger + MWAC)
  → Finished Goods Receipt (Phase 3.5: PRODUCTION_RECEIPT → Inventory IN ledger + batch)
  → Inventory Update (Phase 1.5: Update WH-FG-01 InventoryBalance & blended MWAC)
  → Order Fulfillment (Phase 2.5: Reserve/fulfill SalesOrder → InventoryIssue OUT ledger)
  → Invoicing (Phase 2.6 / 4.2: Generate GST SalesInvoice & PaymentAllocation)
  → Costing and Reports (Phase 3.6–3.7 / 4.2–4.3: Unit cost, COGS, GSTR-1/3B, Audit)
```

### Inventory & Audit Integration at Key Transitions
- **Sales Order Confirmation (`CONFIRMED`):** Calls `InventoryReservationService.reserveStockInTx` (`SELECT ... FOR UPDATE` on `inventory_balances`, FEFO/FIFO non-expired batch selection) and writes an `AuditLog` (`CONFIRM` / `RESERVE`).
- **Raw Material Consumption (Planned Phase 3.5):** Posts an `InventoryTransaction` (`ISSUE`) with `sourceDocType = 'MaterialIssue'`, deducts `quantityOnHand` in `WH-RM-01`/`WH-PKG-01`, and logs `AuditLog`.
- **Finished Goods Receipt (Planned Phase 3.5):** Posts an `InventoryTransaction` (`RECEIPT`) with `sourceDocType = 'ProductionRun'`, creates/updates `InventoryBatch` in `WH-FG-01`, blends warehouse MWAC, and logs `AuditLog`.
- **Sales Order Fulfillment (`FULFILLED`):** Posts an `InventoryIssue` (`ISSUE` ledger transaction), decrements both `quantityOnHand` and `quantityReserved`, records `SalesOrderFulfillment`, and logs `AuditLog` (`FULFILL`).

---

## 7. Frontend Sidebar & Navigation Cross-Check

Inspected from [Sidebar.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/components/layout/Sidebar.tsx) and [router.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/routes/router.tsx) (no files modified):

| Sidebar Label | Route | Sidebar Badge | Master Roadmap Mapping | Observed Discrepancies / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Foundation Dashboard** | `/` | `Active` | Phase 1.1 / 1.2 | Renders `DashboardPlaceholder` |
| **Master Data** | `/master-data` | `Phase 1.4` | Phase 1.4 | Aligned; 12 sub-routes active |
| **Sales & Orders** | `/sales` | `Phase 2` | Phase 2 | Aligned; badge is `teal` while Phase 2 is still `IN_PROGRESS` |
| **Inventory & Stock** | `/inventory` | `Phase 1.5` | Phase 1.5 | Aligned; 9 sub-routes active |
| **BOM & Production** | `/production` | `Phase 3` | Phase 3 (3.1–3.5) | Aligned; renders `ModulePlaceholder` |
| **Costing & Reports** | `/reports` | `Phase 3` | Phase 3 (3.6–3.7) & Phase 4 (4.2–4.3) | Sidebar groups Costing & Audit/GST Reports under `Phase 3`; master roadmap separates Production Costing/Reports (Phase 3) from Financial/BI Reports (Phase 4) |
| **System Admin** | `/admin` | `Phase 4` | Phase 4 (4.1, 4.4) | Sidebar badge says `Phase 4`, but `router.tsx` placeholder text says `"Phase 1.3 Certified Foundation"` |

> **Additional Sidebar Note:** The bottom banner in `Sidebar.tsx` (lines 174–175) still displays `"Phase 1.1 Foundation – Authentication & business logic deferred"`, which is outdated relative to Phases 1.3–2.0. Left untouched per audit-only constraints.

---

## 8. Roadmap Governance Rules

1. **Central Authority:** This document (`docs/architecture/PROJECT_ROADMAP.md`) is the central development roadmap for FoodFactory ERP.
2. **Phase Adherence:** Every future implementation phase must follow this roadmap's module boundaries and dependency order.
3. **Scope Synchronization:** Any approved change in scope (such as Phase 2 deferring invoicing) must be documented in this roadmap immediately.
4. **Preserve Completed Modules:** Existing completed/tested modules (Auth, RBAC, Master Data, Inventory) must not be reimplemented or broken by new phases.
5. **Mandatory Regression Testing:** Every implementation phase must run and pass the full existing regression suite (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`).
6. **Measurable Acceptance Criteria:** Every phase and sub-phase must define and verify concrete completion criteria before promotion.
7. **Evidence-Based Status:** Completion status must strictly reflect observed code, passing tests, and verified workflows—never compilation alone.
8. **Backward-Compatible Migrations:** Database migrations must be additive and backward-compatible wherever practical (zero unapproved `DROP TABLE` / `DROP COLUMN` operations).
9. **Universal Security & RBAC:** Authentication, granular permissions, CSRF/CORS, and `AUDITOR` read-only rules apply to all modules.
10. **Financial Precision:** All monetary, tax, quantity, and costing calculations must use Prisma `Decimal` (or integer paisa) representations—never JavaScript `number` floating-point arithmetic.
11. **Transactional Inventory Integrity:** All stock mutations must flow through the established transactional inventory architecture (`SELECT ... FOR UPDATE`, immutable `InventoryTransactionLine`, non-negative balances).
12. **End-of-Phase Update:** This roadmap must be updated at the conclusion of every implementation phase.
