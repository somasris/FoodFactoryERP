# FoodFactoryERP — Pitch-Ready Interconnected Demo Dataset Report

**Status Legend:** `IMPLEMENTED` | `AUTOMATED_TESTED` | `VERIFIED` | `MANUAL_UI_VERIFIED` | `BLOCKED` | `NOT_SUPPORTED`

---

## 1. Existing Schema and Relationship Analysis (Entity Relationship & Workflow Map)

| Entity | Prisma Model | Primary Relationships & FK Dependencies | Authoritative Service | Lifecycle Statuses | Audit / History Behavior | Demo Seeding |
|---|---|---|---|---|---|---|
| Organization / Facility | `Company`, `Factory`, `Warehouse` | `Factory.companyId → Company`, `Warehouse.factoryId → Factory` | `seed.ts` / Admin services | `isActive` | `AuditLog` on updates | Reused existing `COMP-01`, `FAC-TRICHY-01`, `WH-RM-01`, `WH-PKG-01`, `WH-FG-01` (`VERIFIED`) |
| Users & RBAC | `User`, `Role`, `UserRole`, `RolePermission`, `UserWarehouseAccess` | `User.companyId → Company`, `UserWarehouseAccess → Warehouse` | `seed.ts` / `AuthService` | `APPROVED`, `isActive` | `AuditLog` on login/role changes | Reused existing 5 demo accounts (`VERIFIED`) |
| Master Data | `UnitOfMeasure`, `TaxRate`, `ProductCategory`, `RawMaterialCategory`, `RawMaterial`, `Product`, `ProductVariant`, `InventoryItem` | `InventoryItem → RawMaterial / ProductVariant`, `Product → ProductCategory / TaxRate` | Direct Prisma upsert in `master-data.ts` | `isActive` | Master data baseline | `IMPLEMENTED` & `VERIFIED` |
| Suppliers & Customers | `Supplier`, `SupplierAddress`, `Customer`, `CustomerAddress` | `Address → Supplier / Customer` | Direct Prisma upsert in `master-data.ts` | `isActive` | Referenced by orders/invoices | `IMPLEMENTED` & `VERIFIED` |
| BOM / Recipes | `BOM`, `BOMVersion`, `BOMItem` | `BOM.productVariantId → ProductVariant`, `BOMVersion.bomId → BOM`, `BOMItem.inventoryItemId → InventoryItem` | `BomsService` (`createBom`, `createVersion`, `activateVersion`) | `DRAFT` → `ACTIVE` → `OBSOLETE` | `AuditLog` (`CREATE`, `UPDATE`) | `IMPLEMENTED` & `VERIFIED` |
| Inventory Receipts | `InventoryReceipt`, `InventoryReceiptLine`, `InventoryBalance`, `InventoryBatch`, `InventoryTransaction` | `ReceiptLine → InventoryItem / UOM`, `Balance → Warehouse / InventoryItem / Batch` | `InventoryReceiptService` (`create` → `submit` → `approve` → `post`) | `DRAFT` → `SUBMITTED` → `APPROVED` → `POSTED` | `AuditLog` + `InventoryTransaction` ledger | `IMPLEMENTED` & `VERIFIED` |
| Supplier Invoices | `SupplierInvoice`, `SupplierInvoiceLine`, `SupplierInvoiceReceiptMatch` | `SupplierInvoice → Supplier / Factory / Company`, `Match → InventoryReceipt` | `SupplierInvoiceService` (`createDraft` → `postInvoice` → `matchToReceipts`) | `DRAFT` → `POSTED` (`UNMATCHED` → `MATCHED`) | `SupplierInvoiceStatusHistory` + `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Production Plans & Work Orders | `ProductionPlan`, `ProductionPlanItem`, `WorkOrder` | `PlanItem → ProductVariant / BOMVersion`, `WorkOrder → ProductionPlan / PlanItem` | `ProductionPlanService`, `WorkOrderService` | `DRAFT` → `SUBMITTED` → `APPROVED` → `RELEASED` | `ProductionPlanStatusHistory`, `WorkOrderStatusHistory`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Production Batches & QC | `ProductionBatch`, `ProductionBatchConsumption`, `QualityInspection` | `Batch → WorkOrder / BOMVersion`, `Consumption → InventoryItem`, `QI → ProductionBatch` | `ProductionBatchService`, `MaterialFgService` | `CREATED` → `IN_PROGRESS` → `COMPLETED`; QC `PENDING` → `ACCEPTED` | `ProductionBatchStatusHistory`, `ProductionExecutionEntry`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Production Costing | `ProductionBatchCosting`, `ProductionCostEntry` | `Costing.productionBatchId → ProductionBatch`, `CostEntry → Costing` | `ProductionCostingService` (`addCostEntry` → `reviewCostEntry` → `calculateBatchCosting` → `reviewBatchCosting` → `finalizeBatchCosting`) | `DRAFT` → `CALCULATED` → `REVIEWED` → `FINALIZED` | `ProductionCostingHistory`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Sales Orders & Fulfillment | `SalesOrder`, `SalesOrderLine`, `SalesOrderFulfillment` | `SalesOrder → Customer / Warehouse`, `Line → ProductVariant / InventoryItem` | `SalesService` (`createOrder` → `submitOrder` → `approveOrder` → `confirmOrder` → `fulfillOrder`) | `DRAFT` → `SUBMITTED` → `APPROVED` → `CONFIRMED` → `FULFILLED` | `SalesOrderStatusHistory`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Sales Invoices | `SalesInvoice`, `SalesInvoiceLine` | `SalesInvoice → SalesOrder / Customer / Company / Warehouse` | `SalesInvoiceService` (`createInvoiceFromOrder` → `issueInvoice`) | `DRAFT` → `ISSUED` (`UNPAID` / `PARTIALLY_PAID` / `PAID`) | `SalesInvoiceStatusHistory`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Customer Payments | `CustomerPayment`, `PaymentAllocation` | `Payment → Customer`, `Allocation → CustomerPayment / SalesInvoice` | `CustomerPaymentService` (`createPayment`) | `RECORDED` | `AuditLog` | `IMPLEMENTED` & `VERIFIED` |
| Credit Notes | `CreditNote`, `CreditNoteLine` | `CreditNote → SalesInvoice / Customer` | `CreditNoteService` (`createDraft` → `issueCreditNote`) | `DRAFT` → `ISSUED` | `CreditNoteStatusHistory`, `AuditLog` | `IMPLEMENTED` & `VERIFIED` |

---

## 2. Demo Organization & Business Profile

- **Legal Name:** South Indian Food Works Pvt Ltd (`COMP-01`)
- **Trade Name:** FoodFactory South India
- **Factory:** Trichy Packaged Foods Plant (`FAC-TRICHY-01`, Tamil Nadu, State Code `33`)
- **Warehouses:** `WH-RM-01` (Raw Material), `WH-PKG-01` (Packaging), `WH-FG-01` (Finished Goods)
- **Tenancy Model:** Single-company (`COMP-01`) architecture preserved; no duplicate organization created. All demo master data uses `PITCH-*` codes for strict isolation.

---

## 3. Actual Entities & Records Created (`VERIFIED`)

| Category | Target | Actual Seeded (`PITCH-*`) | Verified |
|---|---:|---:|---|
| Customers | 5 | 5 | Pass |
| Suppliers | 4 | 4 | Pass |
| Product Categories | 3 | 3 | Pass |
| Raw Material Categories | 3 | 3 | Pass |
| Finished Products | 5 | 5 | Pass |
| Raw Materials & Packaging | 6–10 | 8 | Pass |
| BOMs / Recipes | 5 | 5 | Pass |
| BOM Versions (Revisions) | Multiple | 6 (v1+v2 on Ribbon Pakoda) | Pass |
| Inventory Receipts | 4+ | 16 | Pass |
| Supplier Invoices | 3+ | 4 | Pass |
| Production Plans | 3 | 3 | Pass |
| Work Orders | 3+ | 4 | Pass |
| Production Batches | 4 | 4 | Pass |
| Sales Orders | 6 | 6 | Pass |
| Sales Invoices | 5 | 5 | Pass |
| Customer Payments | 6 | 6 | Pass |
| Payment Allocations | Multiple | 6 | Pass |
| Credit Notes | 1–2 | 1 | Pass |
| Audit Logs (`pitch-demo-seed`) | — | 204 | Pass |

---

## 4. Primary Murukku 200g Benchmark Workflow (`VERIFIED` & `AUTOMATED_TESTED`)

- **Opening Inventory (`WH-RM-01`, `WH-PKG-01`, `WH-FG-01`):** Flour `100 kg @ ₹42`, Oil `30 L @ ₹140`, Spice `5 kg @ ₹200`, Pouches `500 pcs @ ₹2.50`, Cartons `30 pcs @ ₹15`, Murukku 200g FG `50 pcs @ ₹30`.
- **Benchmark Purchase (`PINV/2026-27/00007`):** Sri Lakshmi Flour Mills (`PITCH-SUP-01`) — `60 kg` Flour @ `₹45/kg` = `₹2,700.00` taxable + `₹135.00` GST (5%) = `₹2,835.00` (`MATCHED`, `ELIGIBLE` ITC). Flour MWAC updates to `₹43.125/kg` across `160 kg`.
- **Production (`PB/2026-27/00005`):** Consumed `40 kg` Flour (`₹1,725`), `10.5 L` Oil (`₹1,470`), `1.2 kg` Spice (`₹240`), `194` Pouches (`₹485`), `9` Cartons (`₹135`) = `₹4,055.00` material. Recorded `188` good packets (`94%` yield, `12` wastage including `6` damaged pouches). QC `ACCEPTED` → `50 + 188 = 238` packets in `WH-FG-01`.
- **Retailer A (`SO-261128-8C3754` / `INV/2026-27/00001`):** `150` packets @ `₹50` = `₹7,500.00` taxable + `₹187.50` CGST + `₹187.50` SGST = `₹7,875.00` total (`FULFILLED`). Remaining FG stock: `238 - 150 = 88` packets.
- **Distributor B Shortage (`SO-261128-7E5F3A`):** Kaveri Wholesale Mart (`PITCH-CUST-02`, Karnataka) ordered `120` packets → `APPROVED` with `INSUFFICIENT` stock (`88` available, **`32` short**).
- **Retailer A Payment:** `₹4,000.00` (`BANK_TRANSFER`) allocated → **`₹3,875.00` outstanding** (`PARTIALLY_PAID`).

---

## 5. Additional Connected Scenarios (`VERIFIED`)

- **Scenario A (Fully Settled):** Green Basket Retailers (`PITCH-CUST-03`) — `80` Ribbon Pakoda 200g (`₹4,620.00`), fully paid via UPI.
- **Scenario B & F (Multiple Partial Payments + Credit Note):** Lakshmi Supermarket (`PITCH-CUST-04`) — `100` Spicy Mixture 200g (`₹6,825.00`), two partial payments (`₹3,000` NEFT + `₹2,500` UPI) + issued Credit Note for `10` damaged packets (`₹682.50`) = `₹642.50` remaining balance.
- **Scenario C (Repeat Customer, Multi-Product):** Chennai Food Distributors (`PITCH-CUST-05`) — Order 1 (`30` Ragi Health Mix 500g, `₹4,410.00`, `PAID`), Order 2 (`50` Banana Chips 200g @ 12% GST, `₹4,200.00`, `₹2,000.00` cheque paid, `₹2,200.00` outstanding).
- **Scenario D (BOM Revision & Active WIP):** Ribbon Pakoda Batch 2 (`v2` BOM, `145` good), Spicy Mixture Batch 3 (`116` good), Ragi Health Mix Batch 4 (`IN_PROGRESS` on shop floor).
- **Scenario E (Supplier Purchase History):** 4 matched supplier invoices across all 4 suppliers (`Sri Lakshmi Flour Mills`, `Southern Edible Oils`, `Annapoorna Packaging Solutions`, `Kongu Spices & Ingredients`).

---

## 6. Actual Prisma Relationships Used

All records use persisted foreign keys across `Company`, `Factory`, `Warehouse`, `RawMaterial`, `Product`, `ProductVariant`, `InventoryItem`, `InventoryBatch`, `InventoryBalance`, `InventoryTransactionLine`, `BOM`, `BOMVersion`, `BOMItem`, `ProductionPlan`, `WorkOrder`, `ProductionBatch`, `QualityInspection`, `ProductionBatchCosting`, `SalesOrder`, `SalesInvoice`, `CustomerPayment`, `PaymentAllocation`, `CreditNote`, `SupplierInvoice`, and `SupplierInvoiceReceiptMatch`.

---

## 7. Seed Commands & Execution Instructions

- **Seed (idempotent):** `pnpm seed:pitch-demo`
- **Verify & Reconcile only:** `pnpm seed:pitch-demo:verify`
- **Demo-only Reset (`PITCH-*` only):** `pnpm seed:pitch-demo:reset`

---

## 8. Idempotency Safeguards (`VERIFIED`)

- Master data uses `upsert` on `PITCH-*` unique codes.
- Receipts, supplier invoices, plans, work orders, batches, sales invoices, payments, and credit notes use `idempotencyKey` (`PITCH-*`) and state-resumable progression (`DRAFT` → `SUBMITTED` → `APPROVED` → `RELEASED`/`POSTED`/`FULFILLED`).
- Re-running `pnpm seed:pitch-demo` completes with zero duplicate records and all checks passing.

---

## 9. Demo Isolation & Reset Safeguards (`VERIFIED`)

- All demo entities are prefixed with `PITCH-`.
- `pnpm seed:pitch-demo:reset` deletes only `PITCH-*` records and `userAgent: 'pitch-demo-seed'` audit logs in strict FK order, never touching `COMP-01`, `FAC-TRICHY-01`, `WH-*`, `Users`, or user-created data.

---

## 10. Financial Reconciliation Results (`VERIFIED` & `AUTOMATED_TESTED`)

- Retailer A Invoice: `₹7,875.00` (`7500.00` + `187.50` CGST + `187.50` SGST), Paid: `₹4,000.00`, Outstanding: `₹3,875.00`.
- Benchmark Flour Supplier Invoice: `₹2,700.00` taxable + `₹135.00` GST = `₹2,835.00` (`MATCHED`).

---

## 11. Inventory Reconciliation Results (`VERIFIED` & `AUTOMATED_TESTED`)

- Murukku 200g FG On Hand (`WH-FG-01`): `88` packets (`50` opening + `188` produced − `150` fulfilled).
- Inventory Ledger vs Balance Reconciliation: `0 mismatches` across all `PITCH-*` items.
- Negative Inventory Balances: `0`.

---

## 12. Production Costing Verification (`VERIFIED` & `AUTOMATED_TESTED`)

- **Total Actual Cost (`PB/2026-27/00005`):** `₹5,855.00` (`₹4,055.00` net material + `₹1,200.00` direct labour + `₹600.00` utilities).
- **Cost per Packet Note (Observed Application Behavior):** `ProductionCostingService.calculateBatchCosting` allocates `wastageAndRejectionCost = 5855 × (12 / 200) = ₹351.30`, yielding `goodOutputCost = ₹5,503.70` and `costPerAcceptedUnit = ₹29.2750` (`5503.70 / 188`), whereas gross `totalActualCost / goodOutput` is `5855 / 188 = ₹31.14`. Per project instructions, the application's authoritative costing formula was preserved unmodified.

---

## 13. Payment & Receivables Verification (`VERIFIED` & `AUTOMATED_TESTED`)

- Verified via `CustomerPaymentService.getCustomerOutstanding`, `GET /api/v1/sales/ageing` (`>= 3875`), and `GET /api/v1/sales/invoices/:id/pdf`.

---

## 14. Lifecycle Timeline Verification (`VERIFIED`)

- `204` `AuditLog` entries generated naturally by service calls (`pitch-demo-seed`), alongside `SalesOrderStatusHistory`, `SalesInvoiceStatusHistory`, `ProductionPlanStatusHistory`, `WorkOrderStatusHistory`, `ProductionBatchStatusHistory`, `ProductionExecutionEntry`, `ProductionCostingHistory`, `CreditNoteStatusHistory`, and `SupplierInvoiceStatusHistory`.

---

## 15. Role-Based Access Verification (`AUTOMATED_TESTED`)

- All 5 demo roles (`OWNER`, `ADMIN`, `SALESMAN`, `PRODUCTION`, `AUDITOR`) authenticated via `POST /api/v1/auth/login`.
- Verified `AUDITOR` blocked from `POST /api/v1/sales/payments` (`403`) and `PRODUCTION` blocked from `GET /api/v1/sales/payments` (`403`).

---

## 16. Actual UI Workflows Tested

- `MANUAL_UI_VERIFIED`: Not executed in a live browser session during this run; all backend API routes, database states, and frontend TypeScript/Vite production builds were verified via automated tests and build gates.

---

## 17. PDF, Excel & CSV Export Verification (`AUTOMATED_TESTED`)

- `GET /api/v1/sales/invoices/:id/pdf`: `200`, valid `%PDF` header.
- `GET /api/v1/reports/export/sales?format=csv`: `200`, contains all 5 seeded products (`Murukku 200g,Traditional Snacks,150.00,7500.00`, etc.).
- `GET /api/v1/reports/export/sales?format=excel`: `200`, valid `PK` (XLSX) binary header.
- `GET /api/v1/reports/export/sales?format=pdf`: `200`, valid `%PDF` header.

---

## 18. Automated Test Results (`AUTOMATED_TESTED`)

- `pnpm --filter @foodfactory/api test -- test/pitch-demo-consistency.test.ts`: **3/3 passed** (`Test Files: 1 passed`, `Tests: 3 passed`).

---

## 19. Typecheck, Lint & Build Results (`VERIFIED`)

- `pnpm typecheck`: Passed (0 errors).
- `pnpm lint`: Passed (0 errors; pre-existing warnings only).
- `pnpm build`: Passed (`@foodfactory/api` `tsc` + `@foodfactory/web` `tsc && vite build`).

---

## 20. Git Commit Hashes & Messages

- `67c688f` — `feat: add demo pitch seeding scripts and master data for FoodFactory ERP`
- `ae7bed1` — `feat(seed): add pitch-ready interconnected food manufacturing demo dataset`
- `0dd360d` — `test(seed): verify pitch demo data consistency, RBAC, and exports`
- *(See `git log` for the documentation commit hash added immediately after this report.)*

---

## 21. Unsupported or Partially Implemented Features (`NOT_SUPPORTED`)

- `SalesOrder` does not persist an `idempotencyKey` column in `SalesService.createOrder`, so the seed script ensures idempotent order lookup via `(customerId, notes)`.
- Multi-tenant organization switching is not part of the single-company (`COMP-01`) schema; demo data is scoped to `COMP-01` using `PITCH-*` prefixes.

---

## 22. Remaining Manual Verification Requirements

- Start the full-stack app (`pnpm dev`) and perform a visual click-through of `FOODFACTORYERP_DEMO_WALKTHROUGH.md` in the browser for each role (`OWNER`, `ADMIN`, `SALESMAN`, `PRODUCTION`, `AUDITOR`) to confirm UI rendering and download dialogs.
