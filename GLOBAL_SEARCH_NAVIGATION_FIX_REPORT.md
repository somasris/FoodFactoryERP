# Global Search & Command Center Navigation Fix Report

**Status:** `IMPLEMENTED`, `AUTOMATED_TESTED` (`MANUAL_UI_VERIFIED` pending live browser walkthrough)  
**Branch:** `main`  
**Date:** 2026-11-27  

---

## 1. Root Cause Analysis

Both broken Command Center Quick Actions in `apps/web/src/config/shortcuts.ts` pointed to unregistered route paths:

| Command Center Action | Broken Route (`shortcuts.ts`) | Authoritative Registered Route (`router.tsx` & `navigation.ts`) |
|---|---|---|
| **Open Inventory** (`act:open-inventory`) | `/inventory/stock` (404) | `/inventory/dashboard` (`InventoryDashboardPage`) |
| **View Expiring Stock** (`act:expiring-stock`) | `/inventory/expiry` (404) | `/inventory/batches` (`BatchExpiryPage`) |

### Audit of All Other Search & Shortcut Targets
- Audited every remaining path in `SHORTCUT_DEFINITIONS` (`apps/web/src/config/shortcuts.ts`) and every `navigationPath` in `apps/api/src/modules/search/search.service.ts`.
- All other targets (`/sales/orders/new`, `/production/plans`, `/production/quality`, `/production/work-orders`, `/sales/orders`, `/reports/executive`, `/activity`, and backend search paths `/sales/orders/:id`, `/master-data/*`, `/inventory/batches`, `/inventory/receipts`, `/inventory/issues`, `/production/*`, `/admin/*`) resolve to valid registered routes.

---

## 2. Changes Implemented

- **[routes.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/config/routes.ts):** Created centralized `ROUTES` constants (`INVENTORY_DASHBOARD: '/inventory/dashboard'`, `INVENTORY_BATCH_EXPIRY: '/inventory/batches'`, etc.).
- **[shortcuts.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/config/shortcuts.ts):** Replaced hardcoded paths with `ROUTES.*`, fixing `act:open-inventory` -> `ROUTES.INVENTORY_DASHBOARD` and `act:expiring-stock` -> `ROUTES.INVENTORY_BATCH_EXPIRY`.
- **[navigation.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/config/navigation.ts):** Updated Inventory sidebar entries to reference `ROUTES.INVENTORY_DASHBOARD`, `ROUTES.INVENTORY_BALANCES`, and `ROUTES.INVENTORY_BATCH_EXPIRY`.
- **[command-center.test.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/test/command-center.test.tsx):** Added regression tests verifying `Open Inventory` navigates to `/inventory/dashboard`, `View Expiring Stock` navigates to `/inventory/batches`, and unauthorized roles (`SALESMAN` lacking `inventory.read`) do not see those actions.

---

## 3. RBAC Findings

- Both `/inventory/dashboard` and `/inventory/batches` require `inventory.read` in `router.tsx`, `navigation.ts`, and `shortcuts.ts`.
- Authorized roles (`OWNER`, `ADMIN`, `PRODUCTION`, `AUDITOR`) see and can navigate to both actions; `SALESMAN` (without `inventory.read`) does not see them in Command Center and receives `/unauthorized` on direct URL entry.

---

## 4. Verification Results

- **Automated (`AUTOMATED_TESTED`):**
  - `pnpm typecheck`: Passed (`0` errors).
  - `pnpm lint`: Passed (`0` errors).
  - `pnpm --filter @foodfactory/api test`: `34` test files (`175` tests) passed.
  - `pnpm --filter @foodfactory/web test`: `40` test files (`142` tests) passed, including `src/test/command-center.test.tsx` (`3` tests) and `src/test/route-coverage.test.tsx` (`7` tests).
  - `pnpm build`: Passed (API `tsc`, Web `tsc && vite build`, PWA service worker).
- **Manual Browser Verification (`MANUAL_UI_VERIFIED`):** Pending live browser walkthrough of `Ctrl+K` -> `Open Inventory` and `View Expiring Stock`, page refresh, direct URL entry, and role-based access check.
