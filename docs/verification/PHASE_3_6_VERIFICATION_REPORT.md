# Phase 3.6 – Production Costing Verification Report

**Status:** `TESTED` (Automated API + Frontend suites, Typecheck, Lint, and Production Build passing; manual browser verification pending)  
**Date:** 2026-11-25  
**Migration:** `20261125083914_production_costing_phase_3_6`

## 1. Costing Methodology & Valuation Rules

1. **Precision:** All financial, quantity, rate, overhead, variance, and unit cost calculations use `Prisma.Decimal` (never JavaScript floating-point `number` arithmetic).
2. **Material Costing (`HISTORICAL_INVENTORY_TRANSACTION`):**
   - Gross material cost sums `ProductionBatchConsumption.totalCost` (which captures the exact historical `InventoryIssue` / `InventoryTransaction` outward cost at issue time, preserving `batchId` traceability).
   - Material return cost sums `ProductionBatchReturn.totalCost` (at historical consumption batch `unitCost`), preventing double-counting.
   - `netMaterialCost = grossMaterialCost - materialReturnCost`, separated into `RAW_MATERIAL` and `PACKAGING` via `InventoryItem.itemType` and reconciled against `InventoryTransactionLine` (`PRODUCTION_BATCH` `ISSUE` and `PRODUCTION_RETURN` `RECEIPT`).
3. **Labour, Machine & Direct Production Expenses:**
   - `ProductionCostEntry` supports `DIRECT_LABOUR`, `MACHINE_COST`, and `OTHER_DIRECT_EXPENSE` with `totalAmount = quantityOrHours * rate`.
   - Entries recorded by `PRODUCTION` default to `PENDING` approval; entries recorded or reviewed by `OWNER`/`ADMIN` are `APPROVED`. Only `APPROVED` entries are included in batch totals.
4. **Production Overhead Allocation:**
   - `BOMVersion.overheads` (`BOMOverhead`) are imported once per `bomOverheadId` (`@@unique([productionBatchId, bomOverheadId])`) into `ProductionOverheadAllocation` (`isFromBom = true`), preventing duplicate application across recalculations.
   - Supports 4 explicit allocation formulas:
     - `PER_BATCH`: `allocatedAmount = rateOrAmount` (`basisValue = 1`)
     - `PER_UNIT`: `allocatedAmount = rateOrAmount * actualGoodQuantity`
     - `PERCENT_OF_MATERIAL`: `allocatedAmount = netMaterialCost * rateOrAmount / 100`
     - `PER_LABOUR_HOUR`: `allocatedAmount = rateOrAmount * approvedLabourHours`
5. **Standard vs Actual & Wastage Separation:**
   - Standard batch costs scale `BOMVersion.items` (`standardQuantity * (1 + scrapTolerancePercent / 100)` via `convertQuantityDecimal` at `InventoryItem.movingAverageCost`) and `BOMVersion.overheads` (`LABOUR` → `standardLabourCost`; `UTILITY`/`MACHINE_DEPRECIATION`/`DIRECT_OVERHEAD` → `standardOverheadCost`).
   - `totalActualCost = netMaterialCost + actualLabourCost + actualMachineCost + otherDirectCost + actualOverheadCost`.
   - `wastageAndRejectionCost = totalActualCost * (rejectedQty + wastageQty) / (acceptedQty + rejectedQty + wastageQty)` (when total produced input > 0).
   - `goodOutputCost = totalActualCost - wastageAndRejectionCost`.
   - `costPerAcceptedUnit = acceptedQty > 0 ? goodOutputCost / acceptedQty : 0` (safe zero-division handling).
   - Variances use `Actual - Standard` (`+` = unfavourable, `-` = favourable) with percentage `variance / standard * 100` (0 when `standard <= 0`).
6. **Finished-Goods Valuation Integration:**
   - At batch completion (Phase 3.4), FG `InventoryBatch` receives an initial provisional unit cost from consumed materials.
   - On `FINALIZED` (inside `prisma.$transaction` with `SELECT ... FOR UPDATE` and idempotency key `finalizationIdempotencyKey`), if `acceptedQuantity > 0` and `!fgValuationApplied`, the FG `InventoryBatch.unitCost` and remaining `InventoryBalance` are updated to `costPerAcceptedUnit`, `InventoryItem.movingAverageCost` (`MWAC`) is adjusted proportionally for remaining on-hand units, and a zero-quantity ledger revaluation `InventoryTransaction` (`referenceType: 'PRODUCTION_COSTING'`, `idempotencyKey: 'COST-FG-' + costing.id`) is posted so historical receipts are never silently overwritten.
   - Post-finalization material returns or quality inspection updates do not mutate finalized numbers; they append an immutable `ProductionCostingHistory` event and `postFinalizationAdjustmentNote`.

## 2. Database Changes (`apps/api/prisma/schema.prisma`)

- Added enums `ProductionCostingStatus`, `ProductionCostEntryType`, `CostEntryApprovalStatus`, `OverheadAllocationMethod`.
- Extended `ProductionExecutionEntryType` with `COST_ENTRY`, `COSTING_CALCULATION`, `COSTING_FINALIZATION`.
- Added models `ProductionBatchCosting`, `ProductionCostEntry`, `ProductionOverheadAllocation`, and `ProductionCostingHistory`.

## 3. API Endpoints (`/api/v1/production/costing/*`)

- `GET /costing/dashboard` (`production.costing.read`)
- `GET /costing/variance-report` (`production.costing.read`)
- `GET /costing/batches` (`production.costing.read`)
- `GET /costing/batches/:batchId` (`production.costing.read`)
- `POST /costing/batches/:batchId/calculate` (`production.costing.entry`)
- `POST /costing/batches/:batchId/entries` (`production.costing.entry`)
- `POST /costing/entries/:entryId/review` (`production.costing.review`)
- `DELETE /costing/entries/:entryId` (`production.costing.entry`)
- `POST /costing/batches/:batchId/overheads` (`production.costing.entry`)
- `DELETE /costing/overheads/:allocationId` (`production.costing.entry`)
- `POST /costing/batches/:batchId/review` (`production.costing.review`)
- `POST /costing/batches/:batchId/finalize` (`production.costing.finalize`)
- `POST /costing/batches/:batchId/post-finalization-note` (`production.costing.finalize`)

## 4. Frontend Pages (`apps/web/src/routes/production/`)

- `ProductionCostingDashboardPage.tsx` (`/production/costing`)
- `BatchCostingDetailPage.tsx` (`/production/costing/batches/:batchId`)
- `CostVarianceReportPage.tsx` (`/production/costing/variance-report`)
- Wired into `ProductionLayout.tsx` and `router.tsx`.

## 5. RBAC Permissions

- `production.costing.read`: `OWNER`, `ADMIN`, `PRODUCTION`, `AUDITOR` (added to `READ_ONLY_PERMISSIONS`).
- `production.costing.entry`: `OWNER`, `ADMIN`, `PRODUCTION`.
- `production.costing.review`: `OWNER`, `ADMIN`.
- `production.costing.finalize`: `OWNER`, `ADMIN`.
- `SALESMAN`: No production costing permissions.

## 6. Automated Verification Results

- **API Tests (`pnpm --filter @foodfactory/api test`):** `13` test files passed, `80` tests passed (`2/2` in `test/production-costing.test.ts`).
- **Web Tests (`pnpm --filter @foodfactory/web test`):** `11` test files passed, `42` tests passed (`3/3` in `src/test/production-costing.test.tsx`).
- **Typecheck (`pnpm typecheck`):** Passed (`0` errors across `@foodfactory/api` and `@foodfactory/web`).
- **Lint (`pnpm lint`):** Passed (`0` errors across `@foodfactory/api` and `@foodfactory/web`).
- **Production Build (`pnpm build`):** Passed (`tsc` + `vite build`).

## 7. Known Limitations

- Manual live browser UI verification has not yet been executed; status remains `TESTED` until verified in browser.
- Phase 3.7 (Dedicated Cross-Batch Production & Financial Reports under `/reports`) is not yet implemented.
