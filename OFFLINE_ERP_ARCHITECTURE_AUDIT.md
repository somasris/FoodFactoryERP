# FoodFactoryERP – Offline-Capable ERP Architecture Audit

**Audit Date:** 2026-11-26  
**Scope:** Full-stack audit of `apps/web` (React 18 + Vite 6 + TypeScript + TanStack Query v5 + React Router v7 + Tailwind CSS) and `apps/api` (Node.js + Express + TypeScript + Prisma 5 + PostgreSQL) prior to Level 3 Offline PWA implementation.

---

## 1. Existing Offline & Persistence Capabilities

| Area | Current Implementation | Offline Readiness |
| :--- | :--- | :--- |
| **Service Worker / PWA** | None. `apps/web/vite.config.ts` only uses `@vitejs/plugin-react`; `index.html` has no web app manifest or service worker registration. | **Missing** |
| **Local Persistence (IndexedDB)** | None. No IndexedDB wrapper (`dexie` or `idb`) is installed. Only `window.localStorage.getItem('ff_sidebar_collapsed')` is used in `AppShell.tsx`. | **Missing** |
| **TanStack Query Cache** | Configured in `apps/web/src/App.tsx` with `staleTime: 10_000`, `retry: 1`, `refetchOnWindowFocus: false` (in-memory only; lost on refresh). | **Partial (In-memory only)** |
| **Authentication & Session** | In-memory `inMemoryAccessToken` in `apps/web/src/services/api-client.ts` (XSS-safe) paired with HTTP-only `refreshToken` cookie (`/api/v1/auth/refresh`) and `X-Requested-With: XMLHttpRequest` CSRF protection (`csrf.middleware.ts`). | **Online-dependent on reload** (requires offline session metadata policy without storing tokens in IndexedDB) |
| **Health Monitoring** | `GET /api/v1/health` and `GET /api/v1/health/database` polled every 15s by `useApiHealth` / `useDatabaseHealth` in `Navbar.tsx`. | **Reusable** for `ONLINE` vs `SERVER_UNAVAILABLE` vs `OFFLINE` detection |
| **Server-Side Idempotency** | `InventoryReceipt`, `InventoryIssue`, `InventoryAdjustment`, `WarehouseTransfer`, `InventoryTransaction`, and `InventoryLedgerService.reverseTransaction` already use `idempotencyKey` + `SELECT ... FOR UPDATE`. | **Reusable** |
| **Real-Time Events** | `NotificationSseService` (`/api/v1/notifications/stream`) uses SSE with 25s heartbeats. | **Online-only** (gracefully degrades when offline) |

---

## 2. Missing Offline Capabilities

1. **Installable PWA & App Shell:** Web App Manifest, PWA icons, offline fallback route/page, Workbox service worker with versioned precaching, safe update prompt, and strict exclusion of `/api/v1/auth/*`, `/api/v1/admin/*`, and sensitive API responses from SW cache.
2. **IndexedDB Local Database:** Structured local stores (`cachedEntities`, `pendingOperations`, `syncAttempts`, `syncConflicts`, `userOfflinePreferences`, `offlineMetadata`) partitioned by `userId` and scoped by factory/warehouse context.
3. **Centralized Offline State Manager:** Distinguishing `ONLINE`, `SERVER_UNAVAILABLE`, `OFFLINE`, `SYNCING`, and `SYNC_ERROR` using `navigator.onLine` + `/api/v1/health` probing with timeout/backoff.
4. **Durable Operation Queue & Multi-Tab Lock:** UUID-keyed operations with dependency ordering, exponential backoff + jitter, permanent vs transient error classification, and Web Locks / `localStorage` lease coordination across tabs.
5. **Backend Sync API (`/api/v1/sync/*`):** Authenticated transactional push/pull endpoints, persistent `SyncOperation` / `SyncIdempotencyRecord` / `SyncConflict` tables, cursor-based incremental pull, and optimistic concurrency checks.
6. **Conflict Detection & Resolution UI:** Explicit conflict categories (`RECORD_MODIFIED`, `STOCK_UNAVAILABLE`, `INSUFFICIENT_PERMISSION`, `INVALID_STATE_TRANSITION`, `MASTER_DATA_CHANGED`, `BATCH_ALREADY_COMPLETED`, `DUPLICATE_OPERATION`, `VALIDATION_FAILED`) and `/sync` Synchronization Center.

---

## 3. APIs Suitable for Offline Queuing (Explicit Allowlist)

Only bounded, draft-capable, or field-capture operations are allowlisted for offline queuing:

| Domain | Operation Type | Target Backend Service | Notes |
| :--- | :--- | :--- | :--- |
| **Inventory** | `INVENTORY_RECEIPT_DRAFT` | `InventoryReceiptService.create` | Creates `DRAFT` receipt; never mutates stock balance until posted online. |
| **Inventory** | `INVENTORY_ISSUE_DRAFT` | `InventoryIssueService.create` | Creates `DRAFT` issue; stock availability revalidated on server. |
| **Inventory** | `INVENTORY_ADJUSTMENT_DRAFT` | `InventoryAdjustmentService.create` | Creates `DRAFT` adjustment subject to approval workflow. |
| **Inventory** | `WAREHOUSE_TRANSFER_DRAFT` | `WarehouseTransferService.create` | Creates `DRAFT` transfer between authorized warehouses. |
| **Sales** | `SALES_ORDER_DRAFT_CREATE` / `UPDATE` | `SalesService.createOrder` / `updateOrder` | Provisional local totals only; server recalculates authoritative prices, discounts, and GST. |
| **Sales** | `SALES_ORDER_SUBMIT` | `SalesService.submitOrder` | Submits an existing or dependent draft order for approval. |
| **Production** | `PRODUCTION_PLAN_DRAFT` | `ProductionPlanService.create` | Creates `DRAFT` plan; MRP/allocations revalidated on server. |
| **Production** | `WORK_ORDER_DRAFT_UPDATE` | `WorkOrderService.update` | Permitted draft/notes updates; approval/release remains online-only. |
| **Production** | `BATCH_PROGRESS_LOG` | `ProductionBatchService` | Progress/output observations, operator notes, downtime events with client timestamp + sequence. |
| **Production** | `BATCH_MATERIAL_CONSUMPTION_DRAFT` | `MaterialFgService` | Queued consumption request; server validates stock & batch state. |
| **Production** | `BATCH_MATERIAL_RETURN_DRAFT` | `MaterialFgService` | Draft material return record. |
| **Quality** | `QUALITY_OBSERVATION_DRAFT` | `MaterialFgService` | Draft inspection observation; final release/quarantine disposition remains server-validated. |

---

## 4. APIs That Must Remain Online-Only

- **Authentication & Session:** `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`.
- **Administration & RBAC:** All `/api/v1/admin/*` and `/api/v1/users/*` (user creation/deactivation, role/permission changes, warehouse access grants, factory/org/system settings).
- **Financial & Invoicing Finalization:** `/api/v1/sales/invoices/*/issue`, `/api/v1/sales/invoices` creation/posting, `/api/v1/production/costing/*/finalize`.
- **Irreversible Inventory & Order Commits:** Sales order `approve`, `confirm` (stock reservation), `fulfill`; inventory `post` / `reverse`; quality final release/recall disposition.
- **Compliance & Governance:** GST compliance submissions, stock audit posting, backup/restore (`/api/v1/operations/backups/*`), maintenance mode toggles, live audit exports.

---

## 5. Business Operations Requiring Server-Side Concurrency Control

1. **Inventory Posting & Reversals (`InventoryReceiptService.post`, `InventoryIssueService.post`, `InventoryAdjustmentService.post`, `WarehouseTransferService`, `InventoryLedgerService.reverseTransaction`):** Must continue using `SELECT ... FOR UPDATE` on `inventory_balances` and `inventory_batches` to prevent negative stock and race conditions.
2. **Sales Order Confirmation & Fulfillment (`InventoryReservationService.reserveStockInTx`):** Row-level locks on `inventory_balances` and FEFO/FIFO batch selection.
3. **Production Batch Execution & FG Receipt (`ProductionBatchService`, `MaterialFgService`):** Transactional state transition validation (`CREATED -> IN_PROGRESS -> COMPLETED`) and row-level locking to prevent duplicate material consumption or duplicate FG receipts.
4. **Sync Push Processing:** Must process each queued operation inside a Prisma transaction (`$transaction`) with `SyncIdempotencyRecord` uniqueness (`userId`, `idempotencyKey`) and optimistic concurrency version checks (`baseServerVersion` vs `updatedAt` / `version`).

---

## 6. Sensitive Data That Must Never Be Cached

- **Credentials & Tokens:** Passwords, `accessToken`, `refreshToken`, `passwordHash`, CSRF secrets, API keys.
- **Service Worker Exclusion:** All `/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/governance/*`, `/api/v1/operations/backups/*`, and `/api/v1/compliance/*` responses must use `NetworkOnly` in the Service Worker.
- **IndexedDB Exclusion:** Never store JWTs, refresh tokens, or raw user credentials in IndexedDB. On logout (online or offline), purge or cryptographically invalidate the current user's local IndexedDB partition.

---

## 7. Existing Idempotency Mechanisms Reused

- `InventoryTransaction.idempotencyKey` (`@unique`)
- `InventoryReceipt.idempotencyKey` (`@unique`)
- `InventoryIssue.idempotencyKey` (`@unique`)
- `InventoryAdjustment.idempotencyKey` (`@unique`)
- `WarehouseTransfer.idempotencyKey` (`@unique`)
- `ProductionBatch` / `WorkOrderNumberSequence` transactional sequence generators
- New `SyncIdempotencyRecord` table will wrap all sync operations with `(userId, idempotencyKey)` uniqueness and link to the underlying domain entity ID so retries return the exact prior outcome without re-executing domain mutations.
