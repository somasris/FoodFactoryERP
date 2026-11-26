# FoodFactoryERP – Full Offline-Capable ERP (Level 3) Implementation Report

**Date:** 2026-11-26  
**Project:** FoodFactoryERP (`apps/web` + `apps/api` + PostgreSQL)  
**Status:** `TESTED` (Code implemented, typechecked, linted, built, and automated API + Web tests passing; live multi-device browser/mobile `MANUAL_UI_VERIFIED` pending manual walkthrough)

---

## 1. Architecture Overview

FoodFactoryERP has been enhanced into an installable, offline-capable Progressive Web Application (PWA) using a **local-first draft & read-cache architecture** backed by **server-authoritative transactional synchronization**:

- **App Shell & Static Assets:** `vite-plugin-pwa` (Workbox `generateSW` with `registerType: 'prompt'`) precaches the application shell, styles, scripts, and `/offline.html` fallback.
- **Strict API Exclusion in Service Worker:** All `/api/.*` routes use `NetworkOnly` in the Service Worker so authenticated ERP payloads, login/logout/refresh requests, and admin/compliance endpoints are never stored in shared Cache Storage.
- **Persistent Local Database (IndexedDB):** `Dexie` (`FoodFactoryOfflineDB` in `apps/web/src/offline/db.ts`) manages 6 user-partitioned stores: `cachedEntities`, `pendingOperations`, `syncAttempts`, `syncConflicts`, `userOfflinePreferences`, and `offlineMetadata`.
- **Connectivity State Machine:** `OfflineContext` + `probeApiServer()` distinguishes `ONLINE`, `OFFLINE`, `SERVER_UNAVAILABLE`, `SYNCING`, and `SYNC_ERROR` using `navigator.onLine` combined with `/api/v1/health` probing (4s timeout + exponential backoff).
- **Durable Operation Queue & Multi-Tab Lock:** `OfflineOperationQueue` persists UUID-keyed operations with dependency ordering and exponential backoff + jitter; `withSyncLock` coordinates across browser tabs using the Web Locks API with a `localStorage` lease fallback.
- **Backend Sync API (`/api/v1/sync/*`):** Authenticated, CSRF-protected, rate-limited Express routes backed by `SyncIdempotencyRecord` and `SyncConflict` Prisma models (`20261126123958_add_offline_sync_models`), dispatching exclusively through existing domain services (`InventoryReceiptService`, `InventoryIssueService`, `InventoryAdjustmentService`, `InventoryTransferService`, `SalesService`, `ProductionPlanService`, `WorkOrderService`, `ProductionBatchService`, `MaterialFgService`).

---

## 2. Offline-Capable vs. Online-Only Operations

### Supported Offline (Queued & Server-Validated on Sync)
- **Read-Only Cache (labelled "Last synchronized data"):** Dashboards, Master Data (products, variants, raw materials, categories, UOMs, customers, suppliers, warehouses, BOMs), Inventory balances/batches, Sales orders, Production plans/work orders/batches, and Executive/BI reports.
- **Queued Business Operations (Explicit Allowlist):**
  - `INVENTORY_RECEIPT_DRAFT`, `INVENTORY_ISSUE_DRAFT`, `INVENTORY_ADJUSTMENT_DRAFT`, `WAREHOUSE_TRANSFER_DRAFT`
  - `SALES_ORDER_DRAFT_CREATE`, `SALES_ORDER_DRAFT_UPDATE`, `SALES_ORDER_SUBMIT`
  - `PRODUCTION_PLAN_DRAFT`, `WORK_ORDER_DRAFT_UPDATE`
  - `BATCH_PROGRESS_LOG`, `BATCH_DOWNTIME_LOG`, `BATCH_MATERIAL_CONSUMPTION_DRAFT`, `BATCH_MATERIAL_RETURN_DRAFT`, `QUALITY_OBSERVATION_DRAFT`

### Online-Only Operations (Never Queued Offline)
- User login, registration, token refresh, and role/permission/user/warehouse administration.
- Inventory posting (`post`) and ledger reversals (`reverse`).
- Sales order approval, stock reservation (`confirm`), fulfillment, and Sales Invoice creation/issuance.
- Production batch completion, production costing finalization, quality release/disposition, GST/compliance submissions, backup/restore, and maintenance mode.

---

## 3. Idempotency, Concurrency & Conflict Handling

- **Server-Side Idempotency:** `SyncIdempotencyRecord` enforces `@@unique([userId, idempotencyKey])`. Retries or duplicate submissions from multiple tabs/devices return the original `SYNCED` result with `duplicate: true` without re-executing domain mutations.
- **Optimistic Concurrency:** Updates (`SALES_ORDER_DRAFT_UPDATE`, `WORK_ORDER_DRAFT_UPDATE`, `BATCH_PROGRESS_LOG`, `BATCH_DOWNTIME_LOG`) verify `baseServerVersion` against server `updatedAt` and reject stale writes as `RECORD_MODIFIED` conflicts.
- **Conflict Resolution (`/sync`):** `SyncCenterPage` displays conflict category, rejection reason, local payload, and server snapshot, offering safe actions: **Retry After Refresh**, **Request Authorized Review**, or **Discard Local Draft**.

---

## 4. Security & Privacy Controls

- **Zero Credential Persistence:** `sanitizeForOfflineStorage()` strips `password`, `passwordHash`, `accessToken`, `refreshToken`, `token`, `secret`, and `jwt` before any IndexedDB write.
- **User Partitioning & Logout Purge:** All IndexedDB queries are scoped by `userId`. Logging out (online or offline) clears `cachedEntities`, `userOfflinePreferences`, and `offlineMetadata` for that user.
- **Server-Side RBAC:** `SyncService.pushBatch` enforces `AUDITOR` read-only restrictions and per-operation permission checks on the server before invoking any domain service.

---

## 5. Manual Verification Matrix

| Platform / Scenario | Status | Notes |
| :--- | :--- | :--- |
| Desktop Chrome (PWA install, offline shell, queue & sync) | `PENDING_MANUAL_UI` | Automated build (`dist/sw.js`, `dist/manifest.webmanifest`) and Vitest suites verified; interactive browser walkthrough pending. |
| Desktop Firefox (offline fallback, IndexedDB persistence) | `PENDING_MANUAL_UI` | Foreground sync fallback implemented; manual browser check pending. |
| Android Chrome / Tablet / iPad (responsive layout, touch controls) | `PENDING_MANUAL_UI` | Responsive Tailwind layouts and `min-h-[36px..40px]` touch targets implemented; physical device testing pending. |
| Multi-user / Multi-device conflict & permission revocation | `TESTED` (API/Web unit/integration) | Automated tests verify `INSUFFICIENT_PERMISSION`, `RECORD_MODIFIED`, `BATCH_ALREADY_COMPLETED`, and idempotent replay; live multi-device walkthrough pending. |
