# FoodFactoryERP – Production Readiness, UI Cleanup & Routing Audit Report

**Audit Date:** 2026-11-25  
**Scope:** Application-wide UI cleanup, traditional green design system standardization, routing & RBAC audit, and automated route coverage.

---

## 1. Complete List of Audited Routes

### Public & Auth Routes
- `/login` (`LoginPage`)
- `/signup` (`LoginPage initialMode="signup"`)
- `/unauthorized` (`UnauthorizedPage`)

### Root & Dashboard Redirects
- `/` (`RoleDashboardRedirect`)
- `/dashboard` (`RoleDashboardRedirect`)

### Master Data (`/master-data/*`)
- `/master-data` (`ModuleIndexRedirect`)
- `/master-data/products` (`master_data.read`)
- `/master-data/product-variants` (`master_data.read`)
- `/master-data/product-categories` (`master_data.read`)
- `/master-data/raw-materials` (`master_data.read`)
- `/master-data/raw-material-categories` (`master_data.read`)
- `/master-data/suppliers` (`suppliers.read` | `master_data.read`)
- `/master-data/customers` (`customers.read`)
- `/master-data/uoms` (`master_data.read`)
- `/master-data/unit-conversions` (`master_data.read`)
- `/master-data/tax` (`master_data.read`)
- `/master-data/warehouses` (`warehouses.read` | `master_data.read`)
- `/master-data/boms` (`bom.read` | `master_data.read`)

### Sales (`/sales/*`)
- `/sales` (`ModuleIndexRedirect`)
- `/sales/dashboard` (`sales.dashboard.read`)
- `/sales/orders` (`sales.orders.read`)
- `/sales/orders/new` (`sales.orders.create`)
- `/sales/orders/:id` (`sales.orders.read`)
- `/sales/orders/:id/edit` (`sales.orders.update`)
- `/sales/approvals` (`sales.orders.approve` | `sales.orders.reject`)
- `/sales/fulfillment` (`sales.orders.fulfill`)
- `/sales/invoices` (`sales.invoices.read`)
- `/sales/invoices/:id` (`sales.invoices.read`)
- `/sales/invoices/:id/edit` (`sales.invoices.update`)
- `/sales/orders/:orderId/invoices/new` (`sales.invoices.create`)

### Inventory (`/inventory/*`)
- `/inventory` (`ModuleIndexRedirect`)
- `/inventory/dashboard` (`inventory.read`)
- `/inventory/balances` (`inventory.read`)
- `/inventory/receipts` (`inventory.read`)
- `/inventory/issues` (`inventory.read`)
- `/inventory/transfers` (`inventory.read`)
- `/inventory/adjustments` (`inventory.read`)
- `/inventory/batches` (`inventory.read`)
- `/inventory/valuation` (`inventory.valuation.read`)
- `/inventory/transactions` (`inventory.read`)

### Production (`/production/*`)
- `/production` (`ModuleIndexRedirect`)
- `/production/planning` (`production.plans.read`)
- `/production/demand` (`production.demand.read`)
- `/production/plans` (`production.plans.read`)
- `/production/plans/:id` (`production.plans.read`)
- `/production/plans/:planId/work-orders/new` (`production.work_orders.create`)
- `/production/work-orders/dashboard` (`production.work_orders.read`)
- `/production/work-orders` (`production.work_orders.read`)
- `/production/work-orders/:id` (`production.work_orders.read`)
- `/production/execution` (`production.batches.read`)
- `/production/batches` (`production.batches.read`)
- `/production/batches/:id` (`production.batches.read`)
- `/production/reconciliation` (`production.batches.read`)
- `/production/quality` (`production.quality.read`)
- `/production/traceability` (`production.batches.read`)
- `/production/costing` (`production.costing.read`)
- `/production/costing/batches/:batchId` (`production.costing.read`)
- `/production/costing/variance-report` (`production.costing.read`)
- `/production/reports` (`production.reports.read`)
- `/production/reports/plan-vs-actual` (`production.reports.read`)
- `/production/reports/work-order-performance` (`production.reports.read`)
- `/production/reports/batch-yield` (`production.reports.read`)
- `/production/reports/material-consumption` (`production.reports.read`)
- `/production/reports/quality` (`production.reports.read`)
- `/production/reports/costing` (`production.reports.costing.read`)
- `/production/boms` (`bom.read`)

### Compliance, BI & Reports (`/reports/*`)
- `/reports` (`ModuleIndexRedirect`)
- `/reports/executive` (`analytics.dashboard.read`)
- `/reports/bi` (`analytics.sales.read` | `analytics.inventory.read` | `analytics.production.read` | `analytics.profitability.read` | `analytics.factory.read`)
- `/reports/compliance` (`compliance.tax.read` | `compliance.inventory.read` | `compliance.documents.read`)
- `/reports/stock-audit` (`compliance.stock_audit.read`)

### Administration, Governance & Operations (`/admin/*`)
- `/admin` (`ModuleIndexRedirect`)
- `/admin/organization` (`administration.organization.read`)
- `/admin/factories` (`administration.factories.read`)
- `/admin/users` (`administration.users.read` | `users.read`)
- `/admin/roles` (`administration.roles.read`)
- `/admin/warehouse-access` (`administration.warehouse_access.read`)
- `/admin/settings` (`administration.settings.read`)
- `/admin/governance` (`governance.audit.read`)
- `/admin/health` (`operations.health.read`)
- `/admin/backups` (`operations.backup.read`)
- `/admin/maintenance` (`operations.maintenance.manage`)

### Fallback
- `*` (`NotFoundPage`)

---

## 2. Pages & Components Refined

- **Module Layouts:** `ModuleLayoutHeader.tsx`, `AdministrationLayout.tsx`, `MasterDataLayout.tsx`, `InventoryLayout.tsx`, `SalesLayout.tsx`, `ProductionLayout.tsx`, `ReportsComplianceLayout.tsx`.
- **Shared Components:** `StateViews.tsx`, `ConfirmDialog.tsx`, `Pagination.tsx`, `Modal.tsx`, `DataTablePage.tsx`, `ReportFilterBar.tsx`, `Navbar.tsx`, `ProtectedRoute.tsx`, `RoleDashboardRedirect.tsx`.
- **Pages:** `UnauthorizedPage.tsx`, `NotFoundPage.tsx`, `ExecutiveDashboardPage.tsx`, `AuditGovernancePage.tsx`, `InventoryDashboardPage.tsx`, `SalesDashboardPage.tsx`, `ProductionPlanningDashboardPage.tsx`, `ProductionExecutionDashboardPage.tsx`, `MaintenancePage.tsx`, `BackupRecoveryPage.tsx`, `StockAuditPage.tsx`.
- **Removed Dead Legacy Files:** `DashboardPlaceholder.tsx`, `ModulePlaceholder.tsx`.

---

## 3. Unnecessary UI Content Removed

- Removed redundant module-level descriptive subtitles from all 6 module layouts (`AdministrationLayout`, `MasterDataLayout`, `InventoryLayout`, `SalesLayout`, `ProductionLayout`, `ReportsComplianceLayout`) and made `ModuleLayoutHeader` `description` optional.
- Removed redundant/technical `PageHeader` descriptions from `ExecutiveDashboardPage` (removed PostgreSQL reference), `AuditGovernancePage`, `InventoryDashboardPage`, `SalesDashboardPage`, `ProductionPlanningDashboardPage`, and `ProductionExecutionDashboardPage`.
- Removed technical implementation details from `ProtectedRoute` (`"Checking cryptographic credentials and access privileges"`), `MaintenancePage` (removed `"HTTP 503"`), `BackupRecoveryPage` (removed internal repo path `docs/operations/DISASTER_RECOVERY_RUNBOOK.md` and `"(never auto-overwrites active DB)"`), and `StockAuditPage`.
- Deleted unused legacy Phase 1.1 placeholder components (`DashboardPlaceholder.tsx`, `ModulePlaceholder.tsx`).

---

## 4. Routing Issues Identified & Fixed

1. **Unprotected Child Routes:** Many nested routes under `/master-data/*`, `/sales/*`, `/inventory/*`, `/production/*`, `/reports/*`, and `/admin/*` only had parent role checks, allowing users (e.g., `SALESMAN`, `PRODUCTION`, `AUDITOR`) to hit restricted pages via direct URL and trigger 403 API errors. Added granular `<ProtectedRoute>` permission guards on all child routes in `router.tsx`.
2. **Hardcoded Module Index Redirects:** `/reports` redirected to `/reports/compliance` (unauthorized for `SALESMAN` and `PRODUCTION`), and `/master-data`, `/sales`, `/inventory`, `/production`, `/admin` used hardcoded redirects. Replaced with `ModuleIndexRedirect` + `getModuleIndexPath()` to redirect to the user's first authorized route in that module.
3. **Sidebar Permission Mismatches:**
   - `/inventory/valuation` in `navigation.ts` previously allowed `inventory.read`, exposing it to `SALESMAN` and `PRODUCTION` even though the backend requires `inventory.valuation.read`. Fixed to `requiredPermissions: ['inventory.valuation.read']`.
   - `/reports/bi` in `navigation.ts` previously required `analytics.dashboard.read`, hiding Business Intelligence from `SALESMAN` (`analytics.sales.read`) and `PRODUCTION` (`analytics.production.read`). Fixed to `anyPermission` matching `ReportsComplianceLayout.tsx` and backend `reports.routes.ts`.
   - `ProductionLayout.tsx` Traceability tab aligned to `production.batches.read` matching `navigation.ts`.
4. **Breadcrumb Fallback:** `Navbar.tsx` fell back to `Operations > Workspace` on nested detail/form routes not listed in `NAV_GROUPS`. Added `basePath` matching for accurate module breadcrumbs.

---

## 5. Role-Based Access Verification

Verified against `apps/api/prisma/seed.ts` (`ROLE_PERMISSIONS_MAP`) and backend route middleware (`requirePermissions`):
- **OWNER:** Full access; default landing `/reports/executive`.
- **ADMIN:** Administrative & operational access; default landing `/admin/organization`.
- **SALESMAN:** Sales orders, customers, invoices, inventory read, sales analytics (`/reports/bi`), demand read; blocked from `/admin/*`, `/inventory/valuation`, `/reports/compliance`, `/production/execution`. Default landing `/sales/dashboard`.
- **PRODUCTION:** Production planning, work orders, execution, batches, quality, costing, inventory read/transfers, production/inventory analytics; blocked from `/inventory/valuation`, `/sales/approvals`, `/admin/*`. Default landing `/production/execution`.
- **AUDITOR:** Strictly read-only across authorized modules; blocked from `/admin/maintenance`, `/sales/orders/new`, `/sales/approvals`, etc. Default landing `/admin/governance`.

---

## 6. Automated Quality & Test Results

- `pnpm typecheck`: **PASSED** (`@foodfactory/api` + `@foodfactory/web`, 0 errors)
- `pnpm lint`: **PASSED** (`@foodfactory/api` + `@foodfactory/web`, 0 errors)
- `pnpm build`: **PASSED** (`@foodfactory/api` `tsc` + `@foodfactory/web` `tsc && vite build`)
- `pnpm --filter @foodfactory/web test --pool=forks --maxWorkers=2`: **PASSED** — 21 test files, 85 tests passed (including 7 new tests in `src/test/route-coverage.test.tsx`).
- `pnpm --filter @foodfactory/api test -- --run`: **PASSED** — 22 test files, 124 tests passed against live PostgreSQL.

---

## 7. Browser Verification & Remaining Blockers

- **Manual Browser Verification:** `BLOCKED` (no interactive browser session or running dev server walkthrough was executed in this environment; all verification was performed via static analysis, `tsc`, `eslint`, `vite build`, and `vitest` jsdom/router + PostgreSQL API integration suites).
