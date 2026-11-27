# Sales Order List Stock Visibility – Verification Report

## 1. Root Cause of Delayed Stock-Shortage Visibility
Previously, `SalesService.listOrders` in `apps/api/src/modules/sales/sales.service.ts` returned sales order headers (`customer`, `warehouse`, `salesman`, `_count.lines`) without evaluating or returning inventory availability. `SalesOrdersPage.tsx` displayed only order status (`DRAFT`, `SUBMITTED`, `APPROVED`, etc.), so users had to open `SalesOrderDetailPage.tsx` and trigger `confirmOrder` (which calls `InventoryReservationService.reserveStockInTx`) or `fulfillOrder` (which calls `InventoryReservationService.fulfillReservedStockInTx`) before discovering insufficient stock errors.

## 2. Existing Stock Calculation Reused
The read-only list and detail availability preview reuses the exact eligibility rules from `InventoryReservationService` (`apps/api/src/modules/inventory/inventory-reservation.service.ts`) and `isBatchExpired` (`apps/api/src/modules/inventory/inventory.utils.ts`):
- `Available Stock = Eligible On-Hand Stock - Active Reservations`
- Only `inventory_balances` where `(quantity_on_hand - quantity_reserved) > 0` and `(ib.id IS NULL OR ib.quality_status = 'ACCEPTED')` are considered.
- Expired batches (`isBatchExpired(expiry_date, refDate)`) are excluded.
- All calculations use `Prisma.Decimal` and are 100% read-only (no `FOR UPDATE` locks, no reservations, no stock mutations).
- For `CONFIRMED` and `PARTIALLY_FULFILLED` orders, the order's own `reservedBaseQuantity` is accounted for, and `fulfilledBaseQuantity` is subtracted so fulfilled quantities are never counted twice.
- UOM conversions use the line's `orderedQuantity / baseQuantity` ratio (matching `SalesService.fulfillOrder`).
- Multiple lines within the same order sharing `(warehouseId, inventoryItemId)` deduct from a local per-order pool so intra-order shortages are caught accurately.

## 3. Backend Changes
- **`apps/api/src/modules/inventory/inventory.utils.ts`**: Added optional `permissions?: string[]` to `UserContext`.
- **`apps/api/src/modules/inventory/inventory-reservation.service.ts`**: Added `InventoryReservationService.getEligibleAvailableByWarehouseAndItem(pairs, refDate)` to perform a single batch SQL lookup across all `(warehouseId, inventoryItemId)` pairs without locking or mutating inventory.
- **`apps/api/src/modules/sales/sales.controller.ts`**: Populated `permissions: req.user!.permissions || []` in `getUserCtx` and forwarded `stockAvailability`, `sortBy`, and `sortOrder` query parameters to `SalesService.listOrders`.
- **`apps/api/src/modules/sales/sales.service.ts`**:
  - Added `StockAvailabilityStatus`, `SalesOrderLineStockAvailability`, `SalesOrderStockAvailability`, `computeOrderStockAvailability`, and `attachStockAvailabilityToOrders`.
  - Updated `SalesService.listOrders` to attach `stockAvailability` to each order on the page, support `stockAvailability` filtering and sorting (`INSUFFICIENT` -> `PARTIAL` -> `SUFFICIENT` -> `NOT_APPLICABLE`), and enforce `inventory.read` RBAC (returning `stockAvailability: null` and `403` on stock filter if unauthorized).
  - Updated `SalesService.getOrderById` to also attach `stockAvailability` for consistency between list and detail views.

## 4. Frontend Changes
- **`apps/web/src/types/sales.ts`**: Added `StockAvailabilityStatus`, `SalesOrderLineStockAvailability`, `SalesOrderStockAvailability`, and `stockAvailability?: SalesOrderStockAvailability | null` on `SalesOrder`.
- **`apps/web/src/services/sales.service.ts`**: Extended `SalesQuery` with `stockAvailability`, `sortBy`, and `sortOrder`.
- **`apps/web/src/components/sales/StockAvailabilityBadge.tsx`**: Added semantic status badge (`Sufficient Stock`, `Insufficient Stock`, `Partial Stock`, `Not Applicable`, `Checking...`, `Unavailable`).
- **`apps/web/src/components/sales/StockShortageTable.tsx`**: Added reusable line-level shortage breakdown table showing `Product` (with SKU), `Requested`, `Available`, `Shortage` (with UOM), and warehouse context.
- **`apps/web/src/routes/sales/SalesOrdersPage.tsx`**:
  - Added **Stock Availability** column with sortable header (`aria-sort`), semantic badges, loading/unavailable states, and expandable inline shortage details (`<button aria-expanded>`).
  - Added **Stock Availability** filter (`All Orders (Stock)`, `Sufficient Stock`, `Insufficient Stock`, `Partial Stock`) integrated with `SavedViewsBar` and pagination.
  - Configured `staleTime: 15_000` and `refetchOnWindowFocus: true`.
- **`apps/web/src/routes/sales/SalesOrderDetailPage.tsx`**: Added `StockAvailabilityBadge` in the header, `StockShortageTable` alert banner for `INSUFFICIENT`/`PARTIAL` orders, and `staleTime: 10_000` / `refetchOnWindowFocus: true`.
- **`apps/web/src/routes/inventory/{InventoryIssuesPage,InventoryReceiptsPage,InventoryTransactionsPage,StockAdjustmentsPage,WarehouseTransfersPage}.tsx`**: Added `queryClient.invalidateQueries({ queryKey: ['sales'] })` on inventory mutations so sales order stock availability refreshes automatically.

## 5. API Response Structure
Each order in `GET /api/v1/sales/orders` and `GET /api/v1/sales/orders/:id` now includes `stockAvailability` (or `null` if the user lacks `inventory.read`):
```json
{
  "stockAvailability": {
    "status": "PARTIAL",
    "warehouseId": "...",
    "warehouseCode": "WH-FG-01",
    "warehouseName": "Finished Goods Warehouse",
    "totalLines": 2,
    "sufficientLines": 1,
    "insufficientLines": 1,
    "lines": [
      {
        "salesOrderLineId": "...",
        "lineNumber": 1,
        "productVariantId": "...",
        "inventoryItemId": "...",
        "sku": "MUR-200",
        "productName": "Murukku 200 g",
        "uomSymbol": "pcs",
        "requestedQuantity": "100",
        "availableQuantity": "65",
        "shortageQuantity": "35",
        "isSufficient": false
      }
    ]
  }
}
```

## 6. Example Order Scenarios
- **Sufficient Stock (`SUFFICIENT`)**: All unfulfilled lines have `availableQuantity >= requestedQuantity` (e.g., 50 pcs requested, 200 pcs available, 0 pcs shortage).
- **Insufficient Stock (`INSUFFICIENT`)**: All active lines have shortages (e.g., 25 pcs requested, 0 pcs available, 25 pcs shortage).
- **Partial Stock (`PARTIAL`)**: At least one line is sufficient and at least one line is short (e.g., Murukku 200 g: 100 pcs requested / 65 pcs available / 35 pcs shortage; Mixture 200 g: 50 pcs requested / 50 pcs available / 0 pcs shortage).

## 7. Query Performance Considerations
- For standard paginated requests, `InventoryReservationService.getEligibleAvailableByWarehouseAndItem` executes **1 single SQL query** using `ANY($1::text[])` across only the unique `(warehouseId, inventoryItemId)` pairs present on the requested page—eliminating N+1 queries and repeated per-product aggregation.
- When `stockAvailability` filtering or sorting is active, all matching orders for the current filter set are evaluated in a single batch query before slicing the requested page so pagination totals remain exact.

## 8. Verification Status
- **IMPLEMENTED**:
  - Backend batch stock availability service, `listOrders` & `getOrderById` enrichment, RBAC enforcement, filtering, and sorting.
  - Frontend `SalesOrdersPage` Stock Availability column, expandable shortage details, filtering, sorting, `SalesOrderDetailPage` shortage banner, and TanStack Query cross-module invalidations.
- **AUTOMATED_TESTED**:
  - `apps/api/test/sales-stock-visibility.test.ts`: 5/5 passed (covering SUFFICIENT, INSUFFICIENT, PARTIAL, line-level shortages, reservations/cancellations, partial fulfillment, expired batches, warehouse isolation, UOM conversion, read-only guarantee, RBAC, and filtered/sorted pagination).
  - `apps/web/src/test/sales-stock-visibility.test.tsx`: 4/4 passed (covering column rendering, badges, expandable shortage table, loading/error states, filtering, sorting, query invalidation, navigation, and detail page actions).
  - `apps/api/test/sales.test.ts`: 5/5 passed.
  - `apps/web/src/test/sales.test.tsx`: 5/5 passed.
  - `pnpm typecheck`: Passed (0 errors).
  - `pnpm lint`: Passed (0 errors).
  - `pnpm --filter @foodfactory/web test`: 42/42 test files passed (149/149 tests passed).
  - `pnpm build`: Passed for both `@foodfactory/api` and `@foodfactory/web`.
  - `pnpm --filter @foodfactory/api test`: 38/39 test files passed (194/195 tests passed). The single failure was in the pre-existing `test/p1-collection-seed.test.ts` (line 346: `totalGrossPaymentsReceived` expected `'1250.00'` vs `'6840.00'` due to existing seeded payment data in the local test database), unrelated to sales order stock visibility.
- **MANUAL_UI_VERIFIED**: Not performed in a live browser session during this run.
- **BLOCKED**: None for this feature (only the unrelated pre-existing `p1-collection-seed.test.ts` assertion on local DB seeded payments).

## 9. Remaining Limitations
- Filtering or sorting by `stockAvailability` evaluates all orders matching the other filters in memory before paginating, which is fast for typical filtered order sets but could be further optimized with a materialized/DB view if order volumes grow into the tens of thousands.
- List-level stock availability is an informative preview; transactional `SELECT ... FOR UPDATE` revalidation in `InventoryReservationService.reserveStockInTx` and `fulfillReservedStockInTx` remains authoritative at confirmation and fulfillment time.
