# Live Factory Pulse Verification Report

**Status:** `TESTED` (Automated API + Frontend tests passing; live interactive browser walkthrough pending `MANUAL_UI_VERIFIED`)

## 1. Metrics & Authoritative Data Sources
- **Endpoint:** `GET /api/v1/production/factory-pulse` (`apps/api/src/modules/production/factory-pulse.service.ts`)
- **Data Sources (PostgreSQL via Prisma):**
  - **Overview:** `ProductionBatch` (`CREATED`, `IN_PROGRESS`, `PAUSED`, `COMPLETED` today), `WorkOrder` (`RELEASED`, `IN_PROGRESS`, delayed `plannedEndDate < now`), `Prisma.Decimal` planned vs actual output.
  - **Material Readiness:** `InventoryBalance` (`quantityOnHand`, `quantityReserved`) vs `ProductionPlanMaterialRequirement.requiredBaseQuantity` and `RawMaterial.minStockAlert`. Reserved stock is never treated as freely available.
  - **Quality Monitoring:** `QualityInspection` (`PENDING`), `InventoryBatch` (`QUARANTINED`, `REJECTED`).
  - **Attention Required:** Prioritized actionable links to delayed work orders, material shortages, pending inspections, and expiring batches (14-day horizon).

## 2. Refresh Architecture & Scoping
- Uses TanStack Query with visibility-aware polling (15s when tab is visible and online; paused when tab is hidden or offline) and honest `Live` / `Reconnecting` / `Delayed` / `Offline` indicators.
- Enforces `requirePermissions('production.batches.read')` and `getAuthorizedWarehouseIds(user, 'READ')`.

## 3. Test Results
- `apps/api/test/factory-pulse.test.ts`: **2/2 passed** (401 unauthenticated, 403 `SALESMAN` blocked, 200 real telemetry for `PRODUCTION`).
- `apps/web/src/test/factory-pulse.test.tsx`: **1/1 passed** (overview KPIs, material shortages, TV Mode entry/exit).
