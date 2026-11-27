# FoodFactoryERP – Sales Order List Sufficient Stock Fix Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Status:**
- Existing Sales Order Stock Analysis & Idempotent Seed (`seed:existing-orders-stock`): `IMPLEMENTED` / `AUTOMATED_TESTED`
- Sales Order List & Fulfillment API Verification: `AUTOMATED_TESTED`
- Live Browser UI Click Verification: `BLOCKED` (Chrome remote debugging `DevToolsActivePort` unavailable in this environment)

---

## 1. Why All Existing Orders Showed Insufficient Stock

Inspecting the 50 most recent eligible Sales Orders in PostgreSQL revealed that every top-page order in the Sales Order List was created by earlier automated/E2E test runs with deliberate or residual shortages:
- **Warehouse mismatch (`SO-261127-871C61`):** Ordered `BAN-200` (1 pcs) in warehouse `SC` (`FAC-TRICHY-01`), whereas `BAN-200` stock existed only in `WH-FG-01` (`0` in `SC`).
- **Quality-blocked / pending-inspection stock (`SO-261127-BE3C1A`, `SO-261127-C5AE2A`, `SO-261127-8885D4`):** Ordered `50 pcs` each in `WH-FG-01`, but each item had only `45 pcs` `ACCEPTED` (plus `3 pcs` `REJECTED` and `50 pcs` `PENDING_INSPECTION`), leaving a `5 pcs` shortage.
- **Partial / multi-line shortages (`SO-261127-2FF5F3`, `SO-261127-0B6424`):** `OTC-MUR-712227` had `355 pcs` (sufficient for 10), while `OTC-LIM-712227` had only `65 pcs` `ACCEPTED` against `100 pcs` ordered (shortage `35 pcs`).
- **Insufficient factory warehouse stock (`SO-261127-28C4DA`):** Ordered `120 pcs` of `MUR200-P0761305` in `FGWH-P0761305` (`FAC-P0761305`), which had `88 pcs` `ACCEPTED` (shortage `32 pcs`).

The Sales Order List API (`SalesService.listOrders` + `InventoryReservationService.getEligibleStockSummaryByWarehouseAndItem`) was calculating availability accurately—the orders genuinely lacked eligible `ACCEPTED`, non-expired stock in their assigned warehouses.

---

## 2. Number of Existing Orders Inspected & Selected

- **Inspected:** 50 most recent eligible orders (`APPROVED`, `CONFIRMED`, `PARTIALLY_FULFILLED`).
- **Selected (7 existing orders across 4 customers and 3 warehouses):**
  1. `SO-261127-871C61` (`6ac1b347-40f3-471f-8446-d4766c7d4b1e`) — `APPROVED`, `ECUST-E2E177838`, `SC` (`BAN-200` x 1)
  2. `SO-261127-BE3C1A` (`b50f9346-35d8-4600-84a6-4154456fb3d0`) — `CONFIRMED`, `ECUST-E2E775676`, `WH-FG-01` (`ESKU-E2E775676` x 50)
  3. `SO-261127-2FF5F3` (`09a7f93f-b512-42af-a221-d7d36efec3dc`) — `APPROVED`, `OTC-CUST-712227`, `WH-FG-01`, **multi-line** (`OTC-MUR-712227` x 10 + `OTC-LIM-712227` x 100)
  4. `SO-261127-0B6424` (`508b8915-62d6-4028-b296-3536cb5b2e63`) — `APPROVED`, `OTC-CUST-712227`, `WH-FG-01` (`OTC-LIM-712227` x 100)
  5. `SO-261127-C5AE2A` (`44bdf0ac-555f-4de1-aca3-d2324afa87fb`) — `CONFIRMED`, `ECUST-E2E337546`, `WH-FG-01` (`ESKU-E2E337546` x 50)
  6. `SO-261127-28C4DA` (`cf631374-eed2-4762-8281-433df571f035`) — `APPROVED`, `CB-P0761305`, `FGWH-P0761305` (`MUR200-P0761305` x 120)
  7. `SO-261127-8885D4` (`0c1521f2-9c6e-4f8c-bfa4-ed641164d5e1`) — `CONFIRMED`, `ECUST-E2E608894`, `WH-FG-01` (`ESKU-E2E608894` x 50)

---

## 3. Products and Quantities Seeded (`pnpm --filter @foodfactory/api seed:existing-orders-stock`)

Seeded via `InventoryReceiptService` (`create -> submit -> approve -> post`) using idempotent keys `SEED-EXISTING-ORDERS-STOCK-<warehouseId>`:

| Warehouse | Factory | SKU | Added Qty | Batch Number |
|---|---|---|---:|---|
| `SC` | `FAC-TRICHY-01` | `BAN-200` | +11 | `SEED-EX-SC-BAN-200-B01` |
| `WH-FG-01` | `FAC-TRICHY-01` | `ESKU-E2E775676` | +15 | `SEED-EX-WH-FG-01-ESKU-E2E775676-B01` |
| `WH-FG-01` | `FAC-TRICHY-01` | `OTC-LIM-712227` | +145 | `SEED-EX-WH-FG-01-OTC-LIM-712227-B01` |
| `WH-FG-01` | `FAC-TRICHY-01` | `ESKU-E2E337546` | +15 | `SEED-EX-WH-FG-01-ESKU-E2E337546-B01` |
| `WH-FG-01` | `FAC-TRICHY-01` | `ESKU-E2E608894` | +15 | `SEED-EX-WH-FG-01-ESKU-E2E608894-B01` |
| `FGWH-P0761305` | `FAC-P0761305` | `MUR200-P0761305` | +42 | `SEED-EX-FGWH-P0761305-MUR200-P0761305-B01` |

`OTC-MUR-712227` in `WH-FG-01` was skipped (`Already sufficient: 355 >= 20`). Re-running `seed:existing-orders-stock` a second time posted `0` receipts, confirming idempotency.

---

## 4. Before / After Availability & Fulfillment Results

- **Before seeding:** `0` of the top 20 orders showed `SUFFICIENT`.
- **After seeding:** `GET /api/v1/sales/orders?stockAvailability=SUFFICIENT&limit=20` returned **7** `SUFFICIENT` orders (including multi-line `SO-261127-2FF5F3`).
- **Actual Fulfillment Verification (via live API + PostgreSQL):**
  1. `SO-261127-BE3C1A` fulfilled -> `200 OK`, status `FULFILLED`, fulfillment `FUL-261127-166B4F`.
  2. `SO-261127-C5AE2A` fulfilled -> `200 OK`, status `FULFILLED`, fulfillment `FUL-261127-1FB3FF`.
  3. Insufficient order `SO-261127-E518BB` rejected -> `400 Bad Request` (`Insufficient available stock for FulItem B. Requested: 500 pcs, Available: 5 pcs, Shortage: 495 pcs (Short by 495).`) with zero inventory mutation.
  4. **Remaining `SUFFICIENT` orders in Sales Order List:** **5** (`SO-261127-871C61`, `SO-261127-2FF5F3`, `SO-261127-0B6424`, `SO-261127-28C4DA`, `SO-261127-8885D4`).

---

## 5. Test and Quality Gate Results

- `pnpm typecheck`: **PASS**
- `pnpm lint`: **PASS** (0 errors)
- `pnpm build`: **PASS**
- `pnpm --filter @foodfactory/api test -- test/sales-stock-visibility.test.ts test/sales-fulfillment-remediation.test.ts`: **PASS** (5/5 and 6/6)
- `pnpm --filter @foodfactory/web test -- src/test/sales-stock-visibility.test.tsx`: **PASS** (4/4)

---

## 6. Remaining Limitations

- **Live Browser UI Verification (`MANUAL_UI_VERIFIED`):** `BLOCKED` because Chrome remote debugging (`DevToolsActivePort`) was unavailable in this environment. All API endpoints, database balances/ledgers, and frontend unit/integration suites were verified directly.
