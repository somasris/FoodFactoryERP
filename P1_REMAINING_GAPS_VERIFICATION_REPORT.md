# FoodFactoryERP – Remaining P1 Gap Remediation Verification Report

**Date:** 2026-11-27  
**Repository:** `D:\somasri\projects\FoodFactoryERP`  
**Branch:** `main`  
**Commits:**
- `efbab8c` — `feat(reports): add customer collection summary report`
- `58b0f34` — `fix(offline): resolve locally queued sales order details`
- `a2c09c6` — `feat(seed): add optional Murukku benchmark demo profile`
- `e66ddab` — `test(compliance): verify remaining P1 gap remediation`

---

## 1. Changes Implemented

### P1.1 – Dedicated Collection Summary Report (`IMPLEMENTED`, `AUTOMATED_TESTED`, `MANUAL_UI_VERIFIED: BLOCKED`)
- **Backend:**
  - Added `CustomerPaymentService.getCollectionReport()` in `apps/api/src/modules/sales/customer-payment.service.ts` using `Prisma.Decimal` arithmetic and `paymentDate` (transaction date, not invoice date).
  - Separates `totalGrossPaymentsReceived`, `totalReversedPayments`, `netCollections` (excluding reversed payments), `totalAllocatedAmount`, and `totalUnallocatedAdvances` without double-counting multi-invoice allocations.
  - Supports `fromDate`, `toDate`, `paymentMode`, `customerId`, and `groupBy` (`daily` or `monthly`), returning breakdowns `byPeriod`, `byPaymentMode`, and `byCustomer`.
  - Added `GET /api/v1/sales/collections` (with `sales.payments.read` RBAC and `?format=csv|excel|pdf` export via `ComplianceExportService.generateCollectionReportExport`) in `customer-payment.controller.ts`, `sales.routes.ts`, and `compliance-export.service.ts`.
- **Frontend:**
  - Added `getCollections` and `downloadCollectionsExport` in `apps/web/src/services/payments.service.ts`.
  - Added `Collection Summary` tab in `apps/web/src/routes/sales/ReceivablesAgeingPage.tsx` with date, payment mode, customer, and daily/monthly grouping filters, KPI summary cards, period/mode/customer tables, CSV/Excel/PDF export, and loading/empty/error states.

### P1.2 – Offline Sales Order Draft Detail Handling (`IMPLEMENTED`, `AUTOMATED_TESTED`, `MANUAL_UI_VERIFIED: BLOCKED`)
- Added `OfflineRepository.findOperationByEntityId()` in `apps/web/src/offline/offline-repository.ts` to look up queued/conflicted/synced `SALES_ORDER` operations in Dexie IndexedDB by local `entityId` or `serverResultEntityId`.
- Updated `SalesOrderFormPage.tsx` to pass `{ offlineQueuedMessage: 'Order saved offline – waiting for sync' }` in navigation state when `isOfflineQueued` is `true` (preserving online behavior unchanged).
- Updated `SalesOrderDetailPage.tsx`:
  - Resolves pending/failed/conflicted local drafts from IndexedDB (`offlineRepo`), displays the locally saved lines, notes, and `Pending Sync` / `Sync Conflict` / `Sync Failed` banner with `Open Sync Center` link (`/sync-center`).
  - Survives page refresh before sync (reads from IndexedDB).
  - Automatically reconciles to `/sales/orders/${serverResultEntityId}` once `syncEngine` marks the operation `SYNCED`, avoiding duplicate creation.

### P1.3 – Optional Murukku 200 g Benchmark Seed Profile (`IMPLEMENTED`, `AUTOMATED_TESTED`)
- Created `apps/api/prisma/seed-murukku-benchmark.ts` exporting `seedMurukkuBenchmarkProfile(prisma)` and wired optional invocation in `apps/api/prisma/seed.ts` when `SEED_BENCHMARK_PROFILE=murukku` or `--benchmark` is passed.
- Seeds master data only (`BM-*` codes via idempotent `upsert`): UOMs & `KG <-> G` conversion (`multiplier: 1000`), `GST_5`, raw materials & packaging (`BM-RM-FLOUR`, `BM-RM-OIL`, `BM-RM-SPICE`, `BM-PKG-POUCH`, `BM-PKG-CARTON`), product & variant (`BM-MURUKKU-200G`, `BM-MURUKKU-200G-PKT` at ₹50.00), `BM-BOM-MURUKKU-200G` (200 expected packets), supplier (`BM-SUP-FLOUR`), and customers (`BM-CUST-RETAILER-A`, `BM-CUST-DIST-B`).
- Executes **zero** business transactions (no opening stock receipts, purchases, batches, orders, invoices, or payments) and never resets or overwrites existing non-`BM-*` records.

---

## 2. Seed Execution Instructions

- **Baseline seed (unchanged):** `pnpm --filter @foodfactory/api exec npx prisma db seed`
- **Optional Murukku 200 g benchmark master data profile:**  
  `SEED_BENCHMARK_PROFILE=murukku pnpm --filter @foodfactory/api exec npx prisma db seed`  
  (or pass `-- --benchmark` to `seed.ts`).

---

## 3. Automated Tests & Quality Gates

- **New P1 Tests:**
  - `apps/api/test/p1-collection-seed.test.ts` (`2/2` passed): Collection Summary Report (multi-allocations, unallocated advances, reversals, daily/monthly grouping, filters, empty range, RBAC, CSV export) + idempotent Murukku 200 g seed profile with zero business transactions.
  - `apps/web/src/test/p1-offline-order-detail.test.tsx` (`3/3` passed): Offline `Pending Sync` draft detail rendering, `CONFLICT` error preservation + Sync Center link, and `Collection Summary` tab UI rendering.
- **Full Monorepo Quality Gates:**
  - `pnpm typecheck`: **EXIT `0`** (`@foodfactory/api` + `@foodfactory/web`)
  - `pnpm lint`: **EXIT `0`** (`0` errors; `9` warnings in `@foodfactory/api`, `5` warnings in `@foodfactory/web`)
  - `pnpm test`: **EXIT `0`** — **77 test files, 326 tests passed** (`@foodfactory/api`: `36` files, `181` tests; `@foodfactory/web`: `41` files, `145` tests)
  - `pnpm build`: **EXIT `0`** (`@foodfactory/api` `tsc` + `@foodfactory/web` `vite build` + PWA SW)

---

## 4. Remaining Limitations & Manual Verification Status

- `MANUAL_UI_VERIFIED: BLOCKED` — Live interactive browser verification (Chrome DevTools offline toggle and interactive UI walkthrough) was not executed in this environment.
