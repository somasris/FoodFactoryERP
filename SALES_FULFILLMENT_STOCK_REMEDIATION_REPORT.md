# FoodFactoryERP – Sales Order Fulfillment Stock Remediation Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Overall Status:**  
- Backend Fix & Stock Summary Enrichment: `IMPLEMENTED` / `AUTOMATED_TESTED`  
- Idempotent Fulfillment Demo Seed (`seed:fulfillment-demo`): `IMPLEMENTED` / `AUTOMATED_TESTED`  
- Sales Order Detail Stock Summary UI: `IMPLEMENTED` / `AUTOMATED_TESTED`  
- Live API & DB End-to-End Fulfillment Verification: `AUTOMATED_TESTED`  
- Live Browser UI Click Verification: `BLOCKED` (Chrome remote debugging `DevToolsActivePort` was unavailable in this environment)

---

## 1. Root Cause of the Insufficient-Stock Issue

1. **Missing Demo Fulfillment Seed Data & Shortages in Existing DB Orders:**
   - `apps/api/prisma/seed-demo-sales.ts` was gated behind `SEED_DEMO_SALES=true` / `--demo-sales`, lacked `Groundnut 200 g` (`GRN-200`), had lower stock quantities (`MUR-200: 500`, `MIX-200: 300`, `BAN-200: 120`, `RIB-200: 250`) than the demo targets (`1000`, `800`, `600`, `600`, `500`), and seeded **no** demo Sales Orders.
   - Meanwhile, the live database contained 52 leftover `CONFIRMED` Sales Orders from earlier E2E test runs (`ECUST-E2E*` / `ESKU-E2E*`) where `orderedQuantity = 50`, `reservedBaseQuantity = 0`, and `ACCEPTED` on-hand stock was only `45` (with `3` `REJECTED` and `50` `PENDING_INSPECTION`). Opening any of those orders and clicking Confirm Fulfillment / Fulfill Remaining triggered `Insufficient available stock ... Requested: 50, Available: 45, Shortage: 5`.
2. **Reservation Release Bug During Fulfillment (`InventoryReservationService.fulfillReservedStockInTx`):**
   - Previously, `fulfillReservedStockInTx` called `releaseReservedStockInTx` with `line.baseQuantity` regardless of `orderLine.reservedBaseQuantity`. If an order line had `0` or partial `reservedBaseQuantity`, fulfilling it would decrement `inventory_balances.quantity_reserved` belonging to *other* confirmed orders on the same item and warehouse.
3. **Incomplete Stock Visibility on `SalesOrderDetailPage`:**
   - `SalesOrderDetailPage.tsx` previously rendered `StockShortageTable` only when `status` was `INSUFFICIENT` or `PARTIAL`, hiding line-level stock availability when `SUFFICIENT`, and did not display `Ordered`, `Already Fulfilled`, `On Hand`, `Reserved`, `Warehouse`, or per-line `Status`.

---

## 2. Exact Code Changes

- `apps/api/src/modules/inventory/inventory-reservation.service.ts`:
  - Added `WarehouseItemStockSummary` and `getEligibleStockSummaryByWarehouseAndItem` (read-only lookup returning `onHand`, `reserved`, and `available` for non-expired `ACCEPTED` batches).
  - Updated `FulfillmentLineRequest` with optional `reservedBaseQuantity` and updated `fulfillReservedStockInTx` to release `min(line.baseQuantity, orderLine.reservedBaseQuantity)` so fulfilling an order never releases another order's reservation.
- `apps/api/src/modules/sales/sales.service.ts`:
  - Extended `SalesOrderLineStockAvailability` with `orderedQuantity`, `fulfilledQuantity`, `onHandQuantity`, and `reservedByOthersQuantity`.
  - Updated `computeOrderStockAvailability` and `attachStockAvailabilityToOrders` to use `getEligibleStockSummaryByWarehouseAndItem`.
  - Passed `reservedBaseQuantity` from `orderLine` in `SalesService.fulfillOrder`.
- `apps/api/prisma/seed-fulfillment-demo.ts` & `apps/api/package.json`:
  - Added `seed:fulfillment-demo` script (`tsx prisma/seed-fulfillment-demo.ts`) and idempotent `seedFulfillmentDemoProfile`.
- `apps/web/src/types/sales.ts`, `apps/web/src/components/sales/StockShortageTable.tsx`, `apps/web/src/routes/sales/SalesOrderDetailPage.tsx`:
  - Added `orderedQuantity`, `fulfilledQuantity`, `onHandQuantity`, `reservedByOthersQuantity` to frontend types.
  - Enhanced `StockShortageTable` with `detailed` mode showing all 10 required columns (`Product`, `Ordered`, `Already Fulfilled`, `Remaining`, `On Hand`, `Reserved`, `Available`, `Shortage`, `Warehouse`, `Status`).
  - Updated `SalesOrderDetailPage` to display the stock summary banner (`All items available for fulfillment`, `Some items unavailable — Partial Stock Availability`, `Insufficient Stock for Order`, or `Stock availability not verified`) and the detailed table for all non-terminal orders.
- `apps/api/test/sales-fulfillment-remediation.test.ts`:
  - Added 6 integration tests covering all fulfillment, reservation, UOM, batch exclusion, idempotency, and concurrency scenarios.

---

## 3. Seeded Products and Quantities

Seeded via `InventoryReceiptService` (`create -> submit -> approve -> post`, idempotency key `DEMO-FULFILLMENT-TOPUP-WH-FG-01-V1`):

| Product | SKU | Target Available | Top-up Receipt Qty | Batch Number |
|---|---|---:|---:|---|
| Murukku 200 g | `MUR-200` | 1,000 pcs | +555 pcs | `DEMO-FUL-MUR-200-B01` |
| Mixture 200 g | `MIX-200` | 800 pcs | +520 pcs | `DEMO-FUL-MIX-200-B01` |
| Banana Chips 200 g | `BAN-200` | 600 pcs | +495 pcs | `DEMO-FUL-BAN-200-B01` |
| Ribbon Pakoda 200 g | `RIB-200` | 600 pcs | +360 pcs | `DEMO-FUL-RIB-200-B01` |
| Groundnut 200 g | `GRN-200` | 500 pcs | +525 pcs | `DEMO-FUL-GRN-200-B01` |

*(Top-up quantities included demand for `SO-DEMO-FUL-001` and `SO-DEMO-FUL-002` so available stock after reservation equaled exact demo targets.)*

---

## 4. Factory and Warehouse Associations

- **Factory:** `FAC-TRICHY-01` (Trichy Packaged Foods Plant, active)
- **Warehouse:** `WH-FG-01` (Finished Goods Warehouse, `FINISHED_GOODS`, linked to `FAC-TRICHY-01`, active)
- **Customer:** `DEMO-CUST-01` (Sri Lakshmi Super Market)

---

## 5. Batch and Ledger Details

- All seeded batches use `qualityStatus = ACCEPTED`, `manufacturingDate` 3 days prior, `expiryDate` 117 days in the future, and realistic unit costs (`28.0000`–`42.0000`).
- Re-running `pnpm --filter @foodfactory/api seed:fulfillment-demo` a second time skipped all 5 products, 5 batches, and 4 orders (`created: []`), confirming full idempotency.

---

## 6. Sales Orders Tested

| Order Number | Type | Status (Before) | Lines |
|---|---|---|---|
| `SO-DEMO-FUL-001` | Single product (sufficient) | `CONFIRMED` | `MUR-200` x 25 |
| `SO-DEMO-FUL-002` | Multi-product (sufficient) | `CONFIRMED` | `MUR-200` x 30, `MIX-200` x 20, `BAN-200` x 15, `RIB-200` x 10, `GRN-200` x 25 |
| `SO-DEMO-FUL-003` | Partial availability | `APPROVED` | `MIX-200` x 15 (sufficient), `COC-200` x 40 (insufficient) |
| `SO-DEMO-FUL-004` | Intentionally insufficient | `CONFIRMED` | `COC-200` x 50 (0 on hand) |

---

## 7. Fulfillment Results (Live API + DB Verification)

- **Test A (`SO-DEMO-FUL-001`):** `GET /sales/orders/:id` returned `stockAvailability.status = SUFFICIENT`. `POST /sales/orders/:id/fulfill` returned `200 OK`, status updated to `FULFILLED`, fulfillment `FUL-261127-056F7E`, ledger transaction `TXN-261127-27B6D7` (`ISSUE`).
- **Test B (`SO-DEMO-FUL-002`):** `GET /sales/orders/:id` returned `stockAvailability.status = SUFFICIENT` (5 lines). `POST /sales/orders/:id/fulfill` returned `200 OK`, status updated to `FULFILLED`, fulfillment `FUL-261127-892C24`, ledger transaction `TXN-261127-85967B` (`ISSUE`).
- **Test C (`SO-DEMO-FUL-004`):** `GET /sales/orders/:id` returned `stockAvailability.status = INSUFFICIENT` (shortage `50`). `POST /sales/orders/:id/fulfill` returned `400 Bad Request` (`Insufficient available stock for Coconut Biscuits 200 g. Requested: 50 pcs, Available: 0 pcs, Shortage: 50 pcs (Short by 50).`) with zero inventory mutation.
- **Test D (Repeated fulfillment on `SO-DEMO-FUL-001`):** Same `idempotencyKey` returned `200 OK` without double deduction; new request returned `400 Bad Request` (`Only CONFIRMED or PARTIALLY_FULFILLED orders can be fulfilled (current status: FULFILLED).`).
- **Test E (Reservation isolation & concurrency):** Verified in `sales-fulfillment-remediation.test.ts` tests 5 and 6.

---

## 8. Inventory Before / After Quantities (`WH-FG-01`)

| SKU | Batch | On Hand Before | Reserved Before | On Hand After | Reserved After |
|---|---|---:|---:|---:|---:|
| `MUR-200` | `DEMO-MUR-200-B01` | 500 | 55 | 445 | 0 |
| `MUR-200` | `DEMO-FUL-MUR-200-B01` | 555 | 0 | 555 | 0 |
| `MIX-200` | `DEMO-MIX-200-B01` | 300 | 20 | 280 | 0 |
| `MIX-200` | `DEMO-FUL-MIX-200-B01` | 520 | 0 | 520 | 0 |
| `BAN-200` | `DEMO-BAN-200-B01` | 120 | 15 | 105 | 0 |
| `BAN-200` | `DEMO-FUL-BAN-200-B01` | 495 | 0 | 495 | 0 |
| `RIB-200` | `DEMO-RIB-200-B01` | 250 | 10 | 240 | 0 |
| `RIB-200` | `DEMO-FUL-RIB-200-B01` | 360 | 0 | 360 | 0 |
| `GRN-200` | `DEMO-FUL-GRN-200-B01` | 525 | 25 | 500 | 0 |

---

## 9. Test Results

- `pnpm --filter @foodfactory/api test -- test/sales-fulfillment-remediation.test.ts`: **6 passed (6)** (`AUTOMATED_TESTED`)
- `pnpm --filter @foodfactory/api test -- test/sales-stock-visibility.test.ts`: **5 passed (5)** (`AUTOMATED_TESTED`)
- `pnpm --filter @foodfactory/web test`: **43 files passed, 156 tests passed** (`AUTOMATED_TESTED`)
- `pnpm --filter @foodfactory/api test` (full suite): **39 files passed (200 tests passed)**, 1 pre-existing failure in `test/p1-collection-seed.test.ts` (unrelated collection summary test affected by cumulative payment rows in shared DB).

---

## 10. Quality Gate Results

- `pnpm typecheck`: **PASS** (0 errors across `@foodfactory/api` and `@foodfactory/web`)
- `pnpm lint`: **PASS** (0 errors; 9 pre-existing warnings in `api`, 5 pre-existing warnings in `web`)
- `pnpm build`: **PASS** (`tsc` + `vite build` + PWA precache)

---

## 11. Git Commit Hashes

- `742db2f` – `fix(sales,inventory): isolate order reservations during fulfillment and enrich stock summary`
- `711a1f9` – `feat(seed): add idempotent sales fulfillment demo seed profile`
- `6293003` – `feat(web): display line-level stock availability summary on sales order detail page`
- `c96f429` – `test(sales): add integration tests for fulfillment, reservations, and concurrency`

---

## 12. Remaining Limitations

- **Live Browser UI Verification (`MANUAL_UI_VERIFIED`):** `BLOCKED` in this session because Chrome remote debugging (`C:\Users\ADMIN\AppData\Local\Google\Chrome\User Data\DevToolsActivePort`) was not running. Backend API, database state, and React component unit/integration tests were all verified directly.
- **Pre-existing Leftover E2E Test Orders:** Existing `CONFIRMED` E2E test orders (`ECUST-E2E*`) in the shared dev database were preserved per policy (no table truncation or deletion); those orders legitimately have `45` available vs `50` ordered and continue to report insufficient stock.
