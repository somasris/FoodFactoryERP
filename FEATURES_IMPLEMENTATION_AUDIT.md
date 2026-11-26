# FoodFactoryERP – Five-Feature Implementation & Overlap Audit

**Audit Date:** 2026-11-26  
**Scope:** Pre-implementation audit for Command Center (`Ctrl + K`), Live Factory Pulse, Dashboard TV Mode, Scan-to-Trace QR System, and English + Tamil Localization.

---

## 1. Existing Functionality Discovered & Reused

| Requested Feature | Existing Infrastructure Found | Reuse & Extension Decision |
| :--- | :--- | :--- |
| **Command Center (`Ctrl + K`)** | `NAV_GROUPS` in `apps/web/src/config/navigation.ts` (permission-gated routes), `Navbar.tsx` header, `auth.middleware.ts` RBAC + `getAuthorizedWarehouseIds`. | Add `GET /api/v1/search?q=...&limit=...` backend endpoint enforcing server-side RBAC + warehouse scope, plus `CommandCenterModal.tsx` in `AppShell.tsx` and header trigger in `Navbar.tsx`. |
| **Live Factory Pulse** | `ProductionBatchService`, `WorkOrderService`, `ProductionPlanService`, `InventoryService`, `MaterialFgService`, and `NotificationSseService` (`/api/v1/notifications/stream`). | Add `GET /api/v1/production/factory-pulse` aggregating real Prisma queries with `getAuthorizedWarehouseIds` + factory filter; reuse existing detail routes (`/production/batches/:id`, `/production/work-orders/:id`, `/production/quality`, `/inventory/batches`). |
| **Dashboard TV Mode** | `FactoryPulsePage` data source + browser Fullscreen API (`requestFullscreen` / `exitFullscreen`) + `Escape` key. | Add dedicated full-screen 16:9 presentation layout (`FactoryPulseTvView.tsx`) integrated into `FactoryPulsePage`, preserving normal auth/RBAC/scope and excluding sensitive financial/customer data. |
| **Scan-to-Trace QR** | `MaterialFgService.recallLookup`, `BatchTraceabilityPage.tsx`, `ScannerInput.tsx` (camera `BarcodeDetector` + manual fallback), `BarcodeLabel` model (`BarcodeEntityType`). | Add `BatchQrReference` model (opaque HMAC/random token, revocation, single active QR per batch) + `/api/v1/production/traceability/qr/*` endpoints, real ISO QR rendering (`qrcode` package), A4/compact print label view, and `/trace/batch/:reference` page reusing `MaterialFgService.recallLookup` & `ProductionBatch` relations. |
| **English + Tamil Localization** | None (`I18n` not yet implemented). | Add lightweight typed `I18nContext` (`en` / `ta` domain dictionaries, English fallback, `Intl` date/number/currency formatting, per-user preference persistence, header `English | தமிழ்` switcher) with zero external dependency bloat. |

---

## 2. Duplicate Functionality Avoided

- No second batch genealogy table or inventory history: QR traceability reuses `ProductionBatch`, `ProductionBatchConsumption`, `ProductionBatchReturn`, `QualityInspection`, `InventoryBatch`, and `InventoryTransaction`.
- No separate notification/SSE broker: Factory Pulse uses controlled visibility-aware polling + `/api/v1/health` status.
- No duplicate dashboard metrics: Factory Pulse queries authoritative PostgreSQL tables via Prisma using existing lifecycle statuses.
- No second barcode scanner component: `ScannerInput.tsx` is reused and enhanced where needed.

---

## 3. Route & Permission Conventions

- **API Base Path:** `/api/v1` (`authenticate`, `requirePermissions`, `getAuthorizedWarehouseIds`).
- **New Routes:**
  - `GET /api/v1/search` (authenticated, per-entity permission filtering)
  - `GET /api/v1/production/factory-pulse` (`production.batches.read` / `production.work_orders.read` / `production.plans.read`)
  - `POST /api/v1/production/batches/:batchId/qr` (`production.batches.read` / `execute`), `POST /api/v1/production/batches/:batchId/qr/revoke`, `GET /api/v1/production/traceability/qr/:reference` (authenticated, RBAC + warehouse scoped)
- **Frontend Routes:**
  - `/production/factory-pulse` (Live Factory Pulse + TV Mode)
  - `/trace/batch/:reference` (Authenticated QR Traceability Page)
  - `/production/traceability` (Existing Batch Genealogy + QR Scanner entry)
