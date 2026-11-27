# FoodFactoryERP – Order-to-Cash Flow Remediation Report

**Repository:** `D:\somasri\projects\FoodFactoryERP`  
**Date:** 2026-11-27  
**Scope:** Master Data, Demo Seed, Inventory Availability & Reservation, Sales Order Fulfilment, GST Invoicing, Customer Payments, Payment Allocation, Receivables & Ageing

---

## 1. Executive Summary

Two major interruptions in the Order-to-Cash workflow (`Product Master → Available Finished Goods Stock → Customer Order → Order Approval → Stock Reservation → Fulfilment → GST Invoice → Customer Payment → Payment Allocation → Invoice Payment Status → Customer Outstanding / Receivables`) were diagnosed and remediated:

1. **Inventory & Fulfilment Break (`Insufficient Stock`):**
   - **Root Causes:**
     1. Default seed (`apps/api/prisma/seed.ts` and benchmark seed) created finished-goods master data without demo finished-goods stock, leaving `InventoryBalance` empty for sales demos/testing.
     2. `InventoryReservationService.releaseReservedStockInTx` in `apps/api/src/modules/inventory/inventory-reservation.service.ts` released reservations in `created_at DESC` (LIFO) order instead of FEFO order, causing multi-batch/concurrent reservation-and-release flows to unlock the wrong batch and leave the FEFO batch's `quantity_reserved` locked during fulfilment.
     3. Shortage errors in `reserveStockInTx` and `fulfillReservedStockInTx` short-circuited on the first failing line without reporting all insufficient lines or exact `Requested / Available / Shortage` quantities.
   - **Remediation:**
     - Added optional, idempotent demo sales seed (`apps/api/prisma/seed-demo-sales.ts`, wired into `apps/api/prisma/seed.ts` via `SEED_DEMO_SALES=true` or `--demo-sales`) using `InventoryReceiptService` (`create → submit → approve → post`) with `idempotencyKey: 'DEMO-SALES-OPENING-RECEIPT-WH-FG-01'`.
     - Fixed `releaseReservedStockInTx` to release reservations in FEFO order (`expiry_date ASC NULLS LAST, received_date ASC, created_at ASC`, non-expired `ACCEPTED` batches first) matching `reserveStockInTx`.
     - Updated `reserveStockInTx` and `fulfillReservedStockInTx` to aggregate and report all insufficient lines with item-level `Requested`, `Available`, and `Shortage` values.

2. **Invoice-to-Payment Workflow Break:**
   - **Root Causes:**
     1. `apps/web/src/routes/sales/SalesInvoiceDetailPage.tsx` had no **Record Payment** action/modal and no **Payment & Allocation History** table, leaving users without an in-context way to record/allocate payments or inspect payment allocations after issuing an invoice.
     2. `apps/web/src/routes/sales/CustomerPaymentsPage.tsx` did not support optional immediate invoice allocation when recording a payment, lacked client-side `idempotencyKey` generation per modal session, and lacked inline success feedback.
   - **Remediation:**
     - Added permission-gated **Record Payment** button, **Record & Allocate Payment Modal** (with excess-payment advance warning, stable `idempotencyKey` per modal open, atomic `paymentsService.create` with allocation, and `['sales']` query invalidation), and **Payment & Allocation History** table to `SalesInvoiceDetailPage.tsx`.
     - Added optional **Allocate to Invoice (Optional)** selector (auto-loading open receivables for the selected customer and pre-filling amount), `idempotencyKey` protection, and success banner to `CustomerPaymentsPage.tsx`.

---

## 2. Verification Status Matrix

| Area | Status | Notes |
|---|---|---|
| Idempotent Demo Sales Seed (`seed-demo-sales.ts`) | `IMPLEMENTED` + `AUTOMATED_TESTED` | Verified idempotency across repeated runs in `apps/api/test/order-to-cash-remediation.test.ts` |
| FEFO Reservation & Release Fix (`inventory-reservation.service.ts`) | `IMPLEMENTED` + `AUTOMATED_TESTED` | Verified multi-batch FEFO reservation, partial release, and full fulfilment |
| Item-level Shortage Reporting (`inventory-reservation.service.ts`) | `IMPLEMENTED` + `AUTOMATED_TESTED` | Verified multi-line shortage error formatting and compatibility with existing tests |
| Invoice Detail Payment Modal & History (`SalesInvoiceDetailPage.tsx`) | `IMPLEMENTED` | Covered by TypeScript check, ESLint, Vite build, and existing `src/test/sales-invoices.test.tsx` |
| Customer Payments Optional Allocation (`CustomerPaymentsPage.tsx`) | `IMPLEMENTED` | Covered by TypeScript check, ESLint, Vite build, and web Vitest suite |
| Full E2E Order-to-Cash Scenarios 1–8 | `AUTOMATED_TESTED` | All 5 test blocks in `apps/api/test/order-to-cash-remediation.test.ts` passed |
| Live Browser Manual UI Walkthrough | `NOT_RUN` (`MANUAL_UI_VERIFIED` pending) | No live browser automation was executed in this session |

---

## 3. Root Cause Analysis

### 3.1 Inventory & Fulfilment (`Insufficient Stock`)

1. **Missing Finished Goods Stock in Default Seed:**
   - Default seed created finished-goods SKUs without opening `InventoryBalance` / `InventoryBatch` rows, so confirming sales orders immediately failed with `Insufficient available stock`.
2. **FEFO vs LIFO Reservation Release Mismatch:**
   - `reserveStockInTx` allocated stock in FEFO order (`expiry_date ASC NULLS LAST, received_date ASC, created_at ASC`, `ACCEPTED` non-expired batches).
   - `releaseReservedStockInTx` previously released `quantity_reserved` ordered by `created_at DESC` (LIFO). When multiple batches existed and one order was cancelled/released before another was fulfilled, `releaseReservedStockInTx` could release the newer batch while leaving the older FEFO batch locked, or misalign batch-level `quantity_reserved` vs `quantity_on_hand`.
3. **Single-Line Short-Circuit Shortage Errors:**
   - `reserveStockInTx` and `fulfillReservedStockInTx` threw on the first insufficient line without summarizing all short lines or showing exact `Requested`, `Available`, and `Shortage` quantities.

### 3.2 Invoice-to-Payment Workflow

1. **`SalesInvoiceDetailPage.tsx` Gaps:**
   - After issuing an invoice (`status === 'ISSUED'`), the detail page displayed GST totals and PDF download, but offered no **Record Payment** button/modal and no **Payment & Allocation History** section showing `GET /api/v1/sales/invoices/:id/payments` data.
2. **`CustomerPaymentsPage.tsx` Gaps:**
   - Recording a payment created an unallocated advance unless the user performed a separate allocation step, had no per-modal `idempotencyKey` to guard against double-submits, and did not surface a confirmation banner.

---

## 4. Demo Sales Seed Profile

Implemented in `apps/api/prisma/seed-demo-sales.ts` (`DEMO_SALES_PRODUCTS`, `seedDemoSalesProfile`) and wired optionally into `apps/api/prisma/seed.ts` when `SEED_DEMO_SALES === 'true'` or `--demo-sales` is passed:

| Product | SKU | UOM | Demo Opening Stock | Scenario |
|---|---|---|---:|---|
| Murukku 200 g | `MUR-200` | `pcs` | 500 | Sufficient stock |
| Mixture 200 g | `MIX-200` | `pcs` | 300 | Sufficient stock |
| Ribbon Pakoda 200 g | `RIB-200` | `pcs` | 250 | Sufficient stock |
| Thattai 200 g | `THA-200` | `pcs` | 180 | Limited stock |
| Banana Chips 200 g | `BAN-200` | `pcs` | 120 | Limited stock |
| Coconut Biscuits 200 g | `COC-200` | `pcs` | 0 | Zero stock |
| Roasted Cashew Cookies | `CAS-COOK` | `kg` | 0 | Zero stock |

- **Idempotency & Ledger Integrity:**
  - Products/items/customer/warehouse are upserted with stable codes.
  - Opening stock is posted exclusively through `InventoryReceiptService.create → submit → approve → post` with `idempotencyKey: 'DEMO-SALES-OPENING-RECEIPT-WH-FG-01'`.
  - `InventoryBalance` is never mutated directly; re-running `seedDemoSalesProfile` does not duplicate stock or overwrite existing movements.

---

## 5. Inventory & Fulfilment Fixes

**File:** `apps/api/src/modules/inventory/inventory-reservation.service.ts`

1. **FEFO Release Alignment (`releaseReservedStockInTx`):**
   - Queries `InventoryBalance` rows with `quantity_reserved > 0` ordered by `expiry_date ASC NULLS LAST, received_date ASC, created_at ASC` (prioritizing non-expired `ACCEPTED` batches), matching `reserveStockInTx`.
2. **Multi-Line Item-Level Shortage Reporting (`reserveStockInTx` & `fulfillReservedStockInTx`):**
   - Evaluates all order lines before throwing.
   - Formats each insufficient line using `formatShortageMessage`:
     `Insufficient available stock for ${itemName}. Requested: ${requested}${unit}, Available: ${available}${unit}, Shortage: ${shortage}${unit} (Short by ${shortage}).`
   - Preserves compatibility with existing test assertions (`/Insufficient available/i` and `/Short by 32/i`).

---

## 6. Invoice-to-Payment UI Fixes

### 6.1 `apps/web/src/routes/sales/SalesInvoiceDetailPage.tsx`
- Added **Record Payment** button when `inv.status === 'ISSUED'`, `currentOutstanding > 0`, and user holds `sales.payments.create`.
- Added **Record & Allocate Payment Modal**:
  - Inputs: `amount`, `paymentDate`, `paymentMode`, `referenceNumber`, `notes`.
  - Shows advance/excess warning if entered amount exceeds `currentOutstanding` (allocates up to `currentOutstanding`, leaves remainder as customer advance).
  - Generates a stable `idempotencyKey` per modal open to prevent duplicate payment creation on double-click/retry.
  - Calls `paymentsService.create` with `allocations: [{ salesInvoiceId: inv.id, allocatedAmount }]` and invalidates `['sales']` queries so invoice status (`PARTIALLY_PAID` / `PAID`), outstanding balance, and payment history update immediately.
- Added **Payment & Allocation History** table displaying `paymentNumber`, `paymentDate`, `paymentMode`, `allocatedAmount`, and `status` / `REVERSED` badge.

### 6.2 `apps/web/src/routes/sales/CustomerPaymentsPage.tsx`
- Added optional **Allocate to Invoice (Optional)** selector inside the Record Payment modal:
  - Automatically fetches open receivables for the selected customer.
  - Pre-fills payment amount from the selected invoice's outstanding amount when amount is empty.
  - Attaches a stable `idempotencyKey` per modal open and renders a success banner after recording.

---

## 7. Automated Test Coverage

**New Test File:** `apps/api/test/order-to-cash-remediation.test.ts` (5 test blocks):
1. **Demo Sales Seed Idempotency:** Verifies 7 demo products and exact opening stock (`500, 300, 250, 180, 120, 0, 0`), plus zero stock duplication on repeated `seedDemoSalesProfile` calls.
2. **Scenarios 1–8 (Order-to-Cash E2E):**
   - Scenario 1: Sufficient stock order confirm → fulfil → GST invoice → issue.
   - Scenario 2 & 3: Limited stock & zero stock shortage errors with item-level `Requested / Available / Shortage`.
   - Scenario 4, 5, 6, 7, 8: Partial payment (`4000.00` → `PARTIALLY_PAID`), idempotency key deduplication on repeat submit, full payment (`3875.00` → `PAID`), payment reversal (`PARTIALLY_PAID` restored), and customer receivables/ageing consistency.
3. **Excess Payment Advance + Multi-Invoice Allocation:** Verifies excess payment creates unallocated advance and can be allocated across invoices.
4. **Order Cancellation Releases Reserved Stock:** Verifies cancelling a confirmed order restores `quantity_available` / `quantity_reserved`.
5. **FEFO Multi-Batch Reservation & Release:** Verifies earlier-expiring batch is reserved first and released cleanly in FEFO order.

---

## 8. Verification Results

| Check | Command | Result |
|---|---|---|
| TypeScript Check | `pnpm typecheck` | **PASSED** (0 errors across `@foodfactory/api` & `@foodfactory/web`) |
| ESLint | `pnpm lint` | **PASSED** (0 errors; 14 pre-existing warnings in unrelated files) |
| API Integration Tests | `pnpm --filter @foodfactory/api test` | **37/38 files passed (189/190 tests)**; `test/order-to-cash-remediation.test.ts` **5/5 passed** |
| Web Unit/UI Tests | `pnpm --filter @foodfactory/web test` | **41/41 files passed (145/145 tests)** |
| Monorepo Production Build | `pnpm build` | **PASSED** (`@foodfactory/api` `tsc` + `@foodfactory/web` `tsc && vite build`) |

### Known Environment Note (`test/p1-collection-seed.test.ts`)
- `test/p1-collection-seed.test.ts` failed 1 assertion (`expected '1340.00' to be '1250.00'`) when querying `GET /api/v1/sales/collections?fromDate=2026-11-01&toDate=2026-11-30&groupBy=monthly` without a customer filter.
- Inspection of the local PostgreSQL database (`customer_payments`) confirmed three pre-existing `30.00` (`90.00` total) payments from earlier test runs (`CB-P0092501`, `ECUST-E2E232226`, `ECUST-E2E218233`) dated `2026-11-27`, which happened to fall inside `2026-11` because the current date is `2026-11-27`.
- `apps/api/test/order-to-cash-remediation.test.ts` isolates all its payments to `2026-10-15` so it does not pollute `2026-11` collection totals.

---

## 9. Files Changed

- **Created:**
  - `apps/api/prisma/seed-demo-sales.ts`
  - `apps/api/test/order-to-cash-remediation.test.ts`
  - `ORDER_TO_CASH_FLOW_REMEDIATION_REPORT.md`
- **Modified:**
  - `apps/api/prisma/seed.ts`
  - `apps/api/src/modules/inventory/inventory-reservation.service.ts`
  - `apps/web/src/routes/sales/SalesInvoiceDetailPage.tsx`
  - `apps/web/src/routes/sales/CustomerPaymentsPage.tsx`
