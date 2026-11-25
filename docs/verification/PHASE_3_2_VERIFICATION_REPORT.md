# FoodFactory ERP – Phase 3.2 Verification Report (Production Planning)

**Date:** 2026-11-25  
**Milestone:** Phase 3.2 – Production Planning  
**Status:** `TESTED` (Implemented in code, PostgreSQL migration applied, 64 API & 26 frontend tests, `typecheck`, `lint`, and `build` passing; manual browser UI verification pending)

---

## 1. Database Models & Migration
- **Migration:** `20261125065052_production_planning_phase_3_2`
- **New Enum & Models:**
  - `ProductionPlanStatus` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `RELEASED`, `COMPLETED`, `CANCELLED`)
  - `ProductionPlan` (`production_plans`)
  - `ProductionPlanItem` (`production_plan_items`)
  - `ProductionPlanDemandSource` (`production_plan_demand_sources` — links plan items to `SalesOrder` & `SalesOrderLine` with `allocatedBaseQuantity`)
  - `ProductionPlanMaterialRequirement` (`production_plan_material_requirements` — read-only material availability & shortage snapshot)
  - `ProductionPlanStatusHistory` (`production_plan_status_history`)

---

## 2. Backend Implementation (`/api/v1/production`)
- **Demand Generation (`GET /demand`):** Aggregates `CONFIRMED` & `PARTIALLY_FULFILLED` sales order lines, deducts `fulfilledBaseQuantity` and open `ProductionPlanDemandSource` allocations, deducts non-expired unreserved FG `InventoryBalance`, and resolves active effective `BOMVersion`.
- **Plan Lifecycle (`/plans`):**
  - `GET /planning/dashboard`, `GET /plans`, `GET /plans/:id`, `GET /plans/:id/material-availability`
  - `POST /plans`, `PATCH /plans/:id`, `POST /plans/:id/submit`, `POST /plans/:id/approve`, `POST /plans/:id/reject`, `POST /plans/:id/release`, `POST /plans/:id/cancel`
- **Concurrency & Read-Only Inventory Invariant:**
  - Locks referenced `sales_orders` rows with `SELECT ... FOR UPDATE` inside `prisma.$transaction` to prevent concurrent double-counting.
  - Strictly read-only on `InventoryBalance`, `InventoryBatch`, and `InventoryTransaction`.
  - Uses `Prisma.Decimal`, `convertQuantityDecimal`, and `BOMVersion.yieldPercentage` / `scrapTolerancePercent`.

---

## 3. RBAC Permissions
- Added `production.demand.read`, `production.plans.read`, `production.plans.create`, `production.plans.update`, `production.plans.submit`, `production.plans.approve`, `production.plans.release`, `production.plans.cancel`.
- `OWNER` & `ADMIN`: Full access.
- `PRODUCTION`: `demand.read`, `plans.read`, `create`, `update`, `submit`, `release`, `cancel` (cannot `approve`/`reject`).
- `SALESMAN`: `production.demand.read` only.
- `AUDITOR`: `production.demand.read`, `production.plans.read` (strictly read-only in `READ_ONLY_PERMISSIONS`).

---

## 4. Frontend Implementation (`apps/web`)
- Updated `ProductionLayout.tsx` and `router.tsx` with:
  - `ProductionPlanningDashboardPage` (`/production/planning`)
  - `ProductionDemandPage` (`/production/demand`)
  - `ProductionPlansPage` (`/production/plans`)
  - `ProductionPlanDetailPage` (`/production/plans/:id`)

---

## 5. Automated Test & Build Results
- **API Tests (`pnpm --filter @foodfactory/api test`):** **9 test files passed, 64 tests passed, 0 failed** (`test/production-planning.test.ts`: 3/3 passed).
- **Frontend Tests (`pnpm --filter @foodfactory/web test`):** **7 test files passed, 26 tests passed, 0 failed** (`src/test/production-planning.test.tsx`: 4/4 passed).
- **`pnpm typecheck`, `pnpm lint`, `pnpm build`:** Passed (0 errors).

---

## 6. Known Limitations
- Live browser UI verification remains pending (`TESTED`, not `VERIFIED`).
- Work Order execution (`ProductionOrder`, `ProductionRun`, material issue/return) belongs to Phase 3.3–3.5.
