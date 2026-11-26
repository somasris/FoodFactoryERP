# Command Center (`Ctrl + K`) Verification Report

**Status:** `TESTED` (Automated API + Frontend tests passing; live interactive browser walkthrough pending `MANUAL_UI_VERIFIED`)

## 1. Searchable Entities & API
- **Endpoint:** `GET /api/v1/search?q=...&limit=...` (`apps/api/src/modules/search/`)
- **Entities Covered (RBAC & Warehouse-Scoped):**
  - **Sales:** `SalesOrder` (`orderNumber`, `customer.legalName`), `Customer` (`code`, `legalName`, `tradeName`), `SalesInvoice` (`invoiceNumber`).
  - **Inventory:** `RawMaterial`, `InventoryBatch`, `InventoryReceipt`, `InventoryIssue`.
  - **Master Data:** `Product`, `Warehouse`.
  - **Production:** `BOM`, `ProductionPlan`, `WorkOrder`, `ProductionBatch`, `QualityInspection`.
  - **Administration:** `User` (`username`, `fullName` — excludes `passwordHash`), `Factory`.
- **Navigation & Quick Actions:** Permission-filtered routes from `NAV_GROUPS` + Live Factory Pulse + Quick Actions (Create Sales Order, Create Production Plan, Record Inventory Receipt).

## 2. Test Results
- `apps/api/test/search.test.ts`: **3/3 passed** (401 unauthenticated, empty query & invalid limit validation, ADMIN vs SALESMAN RBAC isolation & zero secret exposure).
- `apps/web/src/test/command-center.test.tsx`: **1/1 passed** (search result rendering, keyboard Escape close).

## 3. Known Limitations
- Recent searches are stored per-user in browser `localStorage` (`ff_recent_searches_<userId>`) rather than synced across devices.
