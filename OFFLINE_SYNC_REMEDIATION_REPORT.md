# FoodFactoryERP — Offline-First Architecture Debugging & Sync Remediation Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Scope:** Existing Offline Sales Order Creation, IndexedDB Persistence, Operation Queue, Background Sync, Conflict Resolution, and Sync Center.

---

## 1. Existing Offline Architecture Inspected

- **Frontend Storage & Queue:** `apps/web/src/offline/db.ts` (`FoodFactoryOfflineDB` via Dexie), `offline-repository.ts`, `operation-queue.ts`, `offline-mutation.ts`, `offline-cache.ts`, `connection-state.ts`, `sync-engine.ts`, `sync-lock.ts`, `pwa.ts`.
- **Frontend Context & UI:** `apps/web/src/context/OfflineContext.tsx`, `apps/web/src/hooks/useOfflineSync.ts`, `apps/web/src/components/layout/AppShell.tsx`, `OfflineStatusBadge.tsx`, `SalesOrdersPage.tsx`, `SalesOrderFormPage.tsx`, `SalesOrderDetailPage.tsx`, `SyncCenterPage.tsx`.
- **Backend Sync:** `apps/api/src/modules/sync/sync.service.ts`, `sync.controller.ts`, `sync.routes.ts`, `sync.types.ts`, Prisma models `SyncIdempotencyRecord` and `SyncConflict`.

---

## 2. Actual Root Causes Identified

1. **Broken Sync Center Link in Local Draft Detail (`SalesOrderDetailPage.tsx`):**
   - Linked to `/sync-center` instead of the registered route `/sync`, causing a 404 NotFoundPage when navigating from a local draft.
2. **Offline Queue Count Not Refreshing in UI (`offline-repository.ts`, `useOfflineSync.ts`):**
   - `executeOrQueueOffline` wrote to IndexedDB without notifying `OfflineContext` / `useOfflineSync`, leaving `OfflineStatusBadge` counts stale until page reload or manual visit to `/sync`.
3. **Offline Sales Orders Invisible in Sales Order List (`SalesOrdersPage.tsx`):**
   - `SalesOrdersPage` only queried `cachedApiGet('SALES_ORDERS', ...)`, so newly created offline drafts in `pendingOperations` never appeared in the Sales Orders table while offline.
4. **Offline Order Update & Edit Form Failures (`SalesOrderFormPage.tsx`, `operation-queue.ts`):**
   - Editing a local draft called `salesService.orders.getById(id)` (server/cache only) instead of loading from `pendingOperations`.
   - `salesService.orders.update` did not pass `baseServerVersion` (`updatedAt`) and did not coalesce updates into an existing `PENDING` `SALES_ORDER_DRAFT_CREATE` or chain `dependencyOperationIds`.
5. **Local Draft Detail Blank After Offline Submit (`SalesOrderDetailPage.tsx`, `offline-repository.ts`):**
   - `findOperationByEntityId` returned the *latest* operation (`SALES_ORDER_SUBMIT` with `payload: {}`), wiping out the rendered order lines, customer, and warehouse on `SalesOrderDetailPage`.
6. **Single-Batch Sync & Cross-Batch Dependency ID Loss (`sync-engine.ts`, `sync.service.ts`):**
   - `SyncEngine.runSync` only processed one `getReadyBatch()` per run, leaving dependent `SUBMIT` operations unsynced until a future sync cycle.
   - `SyncService.pushBatch` only kept `localToServerIdMap` in memory for a single HTTP request, so subsequent `UPDATE`/`SUBMIT` batches referencing the temp `localId` failed with 404.
7. **Backend Unreachable While Browser Online (`offline-mutation.ts`, `offline-cache.ts`):**
   - Gateway/proxy errors (`502`, `503`, `504` `ApiError`) were not treated as network/unreachable failures, causing mutations to throw instead of queuing offline when the browser was online but the API was down.
8. **401 Session Expiry Permanently Failing Queued Operations (`sync-engine.ts`):**
   - `SyncEngine.pushBatch` treated `401` identically to `403` and marked pending operations as permanently `FAILED` instead of pausing sync and preserving `PENDING` state until reauthentication.
9. **Duplicate Conflict Rows & Client/Server Conflict ID Mismatch (`sync.service.ts`, `SyncCenterPage.tsx`):**
   - Backend `recordConflict` created duplicate unresolved `SyncConflict` rows on retries and did not return `serverConflictId`, causing `POST /sync/conflicts/:conflictId/resolve` to miss the server record.
10. **Non-Transactional Sequence Generation (`offline-repository.ts`):**
    - `getNextSequence` read/incremented `localSequence` outside a Dexie `rw` transaction.

---

## 3. Files Changed

- `apps/web/src/offline/db.ts` (`serverConflictId` field on `SyncConflictRecord`)
- `apps/web/src/offline/offline-repository.ts` (queue change pub/sub, transactional `getNextSequence`, `listOperationsByEntityId`, `getLocalSalesOrderState`)
- `apps/web/src/offline/operation-queue.ts` (draft update coalescing, automatic `dependencyOperationIds` chaining, `QuotaExceededError` handling)
- `apps/web/src/offline/offline-mutation.ts` & `apps/web/src/offline/offline-cache.ts` (`502`–`504` gateway failure fallback, accurate local-save message)
- `apps/web/src/offline/sync-engine.ts` (multi-batch dependency loop, `localToServerId` propagation to dependent ops & metadata, `401` pause without failing, `403` conflict recording, `ff:offline-sync-completed` event)
- `apps/web/src/hooks/useOfflineSync.ts` & `apps/web/src/context/OfflineContext.tsx` (live queue count subscription, bounded `nextRetryAt` auto-retry timer, `visibilitychange` health probe)
- `apps/web/src/components/layout/AppShell.tsx` (automatic React Query invalidation on `ff:offline-sync-completed`)
- `apps/api/src/modules/sync/sync.service.ts` & `apps/web/src/services/sync.service.ts` (cross-batch `SyncIdempotencyRecord` entity ID lookup, deduplicated `recordConflict` returning `serverConflictId`, server snapshot on `409` `RECORD_MODIFIED`)
- `apps/web/src/routes/sales/SalesOrdersPage.tsx` (merged `LOCAL-DRAFT` rows + pending sync badges on server rows)
- `apps/web/src/routes/sales/SalesOrderFormPage.tsx` (load local draft in edit mode, pass `baseServerVersion`, honest local-save banner)
- `apps/web/src/routes/sales/SalesOrderDetailPage.tsx` (merged local draft view, Edit Draft button, fixed `/sync` link)
- `apps/web/src/routes/SyncCenterPage.tsx` (live queue subscription, `serverConflictId` resolution)
- `apps/web/src/test/sync-queue.test.ts` & `apps/web/src/test/offline-operations.test.ts` (regression tests)

---

## 4. Verification Status by Category

| Area | Status | Notes |
| --- | --- | --- |
| IndexedDB persistence & transactional sequence | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `offline-storage.test.ts`, `sync-queue.test.ts`. |
| Offline order creation, coalesced update & submit | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `offline-operations.test.ts` and `sync-queue.test.ts`. |
| Automatic reconnection, multi-batch sync & `401` pause | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `sync-queue.test.ts` (multi-batch `CREATE -> SUBMIT` + `401` pause). |
| Backend unreachable (`502`–`504`) fallback | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `offline-operations.test.ts`. |
| Backend idempotency, RBAC conflicts & cross-batch ID resolution | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `apps/api/test/sync.test.ts` (4/4 passing). |
| Sales Order List, Form, Detail & Sync Center UI | `IMPLEMENTED`, `AUTOMATED_TESTED` | Verified via `p1-offline-order-detail.test.tsx`, `sync-center.test.tsx`, `sales.test.tsx`. |
| Live Browser Offline → Reconnect → Sync | `BLOCKED` | Chrome remote debugging (`DevToolsActivePort`) is not enabled on the host (`C:\Users\ADMIN\AppData\Local\Google\Chrome\User Data\DevToolsActivePort` not found). |

---

## 5. Quality Gate Results

- `pnpm typecheck`: **PASS** (0 errors across `@foodfactory/api` and `@foodfactory/web`)
- `pnpm lint`: **PASS** (0 errors; pre-existing warnings only)
- `pnpm --filter @foodfactory/web test`: **PASS** (43/43 test files, 155/155 tests passed)
- `pnpm --filter @foodfactory/api test -- test/sync.test.ts`: **PASS** (4/4 tests passed)
- `pnpm build`: **PASS** (production API + VitePWA bundle built cleanly)

---

## 6. Remaining Limitations & Blockers

1. **Live Browser Offline E2E (`BLOCKED`):** Requires enabling Chrome remote debugging (`chrome://inspect/#remote-debugging`) so the browser automation tool can toggle DevTools network offline mode against `http://localhost:5174/`.
2. **Pre-existing Unrelated API Test:** As observed earlier, `apps/api/test/p1-collection-seed.test.ts:346` has a pre-existing DB state mismatch (`6840.00` vs `1250.00`) unrelated to offline sync.

---

## 7. Git Commit Hashes

- `d9a6d04` — `fix(offline): repair IndexedDB persistence and operation queue`
- `5b05069` — `fix(offline): restore automatic synchronization and retry handling`
- `5280332` — `fix(sync): preserve operation dependencies and idempotency`
- `cf61b0e` — `fix(offline): resolve local sales order detail navigation`
- `50516e8` — `test(offline): verify offline order-to-sync workflows`
- *(Pending docs commit for this report)*
