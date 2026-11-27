# FoodFactoryERP – New Sales Order Stock Availability Remediation Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Status:**
- Default Warehouse & Factory Resolution (Frontend + Backend): `IMPLEMENTED` / `AUTOMATED_TESTED`
- Demo Inventory Target Profile (`seed:demo-inventory`, 1,000 packets each): `IMPLEMENTED` / `AUTOMATED_TESTED`
- Enhanced Shortage Error Messages (with Warehouse & Reserved Qty): `IMPLEMENTED` / `AUTOMATED_TESTED`
- Full Order-to-Cash Integration Suite (`new-sales-order-stock.test.ts`): `AUTOMATED_TESTED`
- Live Browser UI Click Verification: `BLOCKED` (Chrome remote debugging `DevToolsActivePort` unavailable in this environment)

---

## 1. Exact Root Cause

1. **Missing Default Fulfillment Warehouse in `SalesOrderFormPage` & Backend:**
   - [SalesOrderFormPage.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/routes/sales/SalesOrderFormPage.tsx) initialized `warehouseId` to `''` and listed all 31 active warehouses (starting with raw-material/packaging/other-factory warehouses) without defaulting to `WH-FG-01` (`FINISHED_GOODS`). Creating an order against a non-FG or other-factory warehouse resulted in `0` eligible stock and `INSUFFICIENT STOCK`.
   - `createSalesOrderSchema` and `SalesService.createOrder` required `warehouseId` with no deterministic server-side fallback to the active `FINISHED_GOODS` warehouse.
2. **Product Variant Selection Ambiguity:**
   - The database had 172 active `ProductVariant` rows (many from automated test runs such as `OTC-MUR-*`, `MUR200-P*`), making it easy to select a variant belonging to a different factory/test profile instead of the stocked `MUR-200`, `MIX-200`, `BAN-200`, `RIB-200`, `GRN-200` variants in `WH-FG-01`.
3. **Demo Stock Targets Below 1,000 Packets:**
   - `MIX-200` (800), `BAN-200` (600), `RIB-200` (600), and `GRN-200` (500) were below the 1,000-packet demo target prior to running `seed:demo-inventory`.

---

## 2. Relevant Files and Functions Changed

- [apps/api/src/modules/sales/sales.types.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/src/modules/sales/sales.types.ts): Made `warehouseId` optional in `createSalesOrderSchema`.
- [apps/api/src/modules/sales/sales.service.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/src/modules/sales/sales.service.ts): Updated `SalesService.createOrder` to deterministically resolve `WH-FG-01` (or first authorized active `FINISHED_GOODS` warehouse) when `warehouseId` is omitted, throwing a clear `400` configuration error if none exists.
- [apps/api/src/modules/inventory/inventory-reservation.service.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/src/modules/inventory/inventory-reservation.service.ts): Updated `formatShortageMessage` and `reserveStockInTx` to include the warehouse code/name and active reserved quantity in shortage error messages.
- [apps/web/src/routes/sales/SalesOrderFormPage.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/routes/sales/SalesOrderFormPage.tsx): Auto-selected `WH-FG-01` (or first `FINISHED_GOODS` warehouse) on new order creation, sorted `FINISHED_GOODS` warehouses first with warehouse type labels, and prioritized demo SKUs (`MUR-200`, `MIX-200`, `BAN-200`, `RIB-200`, `GRN-200`) at the top of the variant selector.
- [apps/api/prisma/seed-fulfillment-demo.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/prisma/seed-fulfillment-demo.ts) & [apps/api/package.json](file:///d:/somasri/projects/FoodFactoryERP/apps/api/package.json): Updated `FULFILLMENT_DEMO_TARGETS` to `1,000` packets each and added `pnpm --filter @foodfactory/api seed:demo-inventory`.
- [apps/api/test/new-sales-order-stock.test.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/test/new-sales-order-stock.test.ts): Added 4 end-to-end integration tests.

---

## 3. Product / Variant / Inventory Mapping & Factory / Warehouse Findings

- **Factory:** `FAC-TRICHY-01` (Trichy Packaged Foods Plant, active)
- **Warehouse:** `WH-FG-01` (Finished Goods Warehouse, `FINISHED_GOODS`, linked to `FAC-TRICHY-01`, active)
- **Verified Mappings (`Product` -> `ProductVariant` -> `InventoryItem` -> `WH-FG-01`):**
  - `MUR-200` (Murukku 200 g) — `PCS`
  - `MIX-200` (Mixture 200 g) — `PCS`
  - `BAN-200` (Banana Chips 200 g) — `PCS`
  - `RIB-200` (Ribbon Pakoda 200 g) — `PCS`
  - `GRN-200` (Groundnut 200 g) — `PCS`

---

## 4. Stock Quantities Before and After (`seed:demo-inventory`)

| Product | SKU | Before | Added via `InventoryReceiptService` | After (Available) |
|---|---|---:|---:|---:|
| Murukku 200 g | `MUR-200` | 1,000 | 0 (skipped) | 1,000 |
| Mixture 200 g | `MIX-200` | 800 | +200 (`DEMO-INV-MIX-200-1000`) | 1,000 |
| Banana Chips 200 g | `BAN-200` | 600 | +400 (`DEMO-INV-BAN-200-1000`) | 1,000 |
| Ribbon Pakoda 200 g | `RIB-200` | 600 | +400 (`DEMO-INV-RIB-200-1000`) | 1,000 |
| Groundnut 200 g | `GRN-200` | 500 | +500 (`DEMO-INV-GRN-200-1000`) | 1,000 |

Re-running `pnpm --filter @foodfactory/api seed:demo-inventory` a second time skipped all 5 items (`receiptPosted=false`), confirming idempotency.

---

## 5. New Order, Multi-Product, Fulfillment & Payment Results (`AUTOMATED_TESTED`)

Verified in [apps/api/test/new-sales-order-stock.test.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/test/new-sales-order-stock.test.ts):
1. **New Small Order (`10 pcs` `MUR-200`, omitted `warehouseId`):** Resolved `WH-FG-01` automatically, returned `stockAvailability.status = SUFFICIENT`.
2. **Multi-Product Order (`MUR-200`, `MIX-200`, `BAN-200` x `10 pcs` each):** Returned `SUFFICIENT`, confirmed & reserved stock, fulfilled (`FULFILLED`), and deducted inventory across all 3 products.
3. **Genuine Shortage (`999,999 pcs` `MUR-200`):** Returned `INSUFFICIENT`, rejected confirm (`400`) with warehouse `WH-FG-01` and exact shortage details, and left inventory unchanged.
4. **Complete Demo Workflow (`Create -> Submit -> Approve -> Confirm -> Fulfill -> Invoice -> Issue -> Payment -> Allocate`):** Completed end-to-end with `paymentStatus = PAID`.

---

## 6. Automated Test & Quality Gate Results

- `pnpm typecheck`: **PASS**
- `pnpm lint`: **PASS** (0 errors)
- `pnpm --filter @foodfactory/api test -- test/new-sales-order-stock.test.ts`: **PASS** (4/4)
- `pnpm --filter @foodfactory/web test`: **PASS** (43 files, 157 tests)
- `pnpm build`: **PASS**

---

## 7. Remaining Limitations

- **Manual Browser Verification (`MANUAL_UI_VERIFIED`):** `BLOCKED` because Chrome remote debugging (`DevToolsActivePort`) was not running in this environment. Refresh `/sales/orders/new` in the browser to see `WH-FG-01` pre-selected and demo SKUs at the top of the product list.
