# FoodFactoryERP — Offline Mode Root-Cause Debugging & Complete Remediation Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Verification Browser:** Microsoft Edge (headless Chromium via `playwright-core`) against live API (`:5000`) and frontend (`http://localhost:5173`)

---

## 1. Exact Root Causes Discovered via Real-Browser Reproduction

Running the actual application in Microsoft Edge with real network offline emulation (`context.setOffline(true)`) exposed **4 critical runtime root causes** that mocked unit tests completely missed:

1. **TanStack Query v5 `networkMode: 'online'` Paused All Offline Queries & Mutations (`apps/web/src/App.tsx`):**
   - **Symptom:** Clicking Save on `/sales/orders/new` while offline stuck the submit button on `"Saving..."` indefinitely without ever calling `executeOrQueueOffline`.
   - **Root Cause:** `QueryClient` in `App.tsx` did not set `networkMode: 'always'` on `queries` or `mutations`. TanStack Query v5 defaults both to `'online'`, which pauses `useMutation` and `useQuery` whenever `navigator.onLine === false`, preventing `salesService.orders.create()` and `cachedApiGet()` from ever executing offline.

2. **React 18 `StrictMode` Concurrent `/auth/refresh` Token-Reuse `401` (`apps/web/src/services/auth.service.ts`):**
   - **Symptom:** Navigating to `/sales/orders` triggered `HTTP 401: "Concurrent token refresh detected. Please use the newly issued session token."`, logging the user out to `/login` before master data could be cached (`cachedEntities: 0`).
   - **Root Cause:** `AuthContext.initAuth()` called `authService.refresh()`, which invoked `apiClient('/auth/refresh')` directly without coalescing concurrent in-flight requests. In React 18 `StrictMode` (dev), `AuthProvider` mounts twice and sends two simultaneous `/auth/refresh` requests with the same cookie, triggering backend token-reuse protection.

3. **Session Loss When Backend Is Unreachable (`apps/web/src/context/AuthContext.tsx`, `apps/web/src/services/api-client.ts`):**
   - **Symptom:** When `navigator.onLine === true` but the backend is unreachable (or returns `502`/`503`/`504`), `AuthContext.initAuth()` and `api-client.ts` `refreshAccessToken()` cleared `sessionHint` and `activeOfflineUserId` instead of falling back to the non-expired IndexedDB session snapshot.
   - **Root Cause:** `AuthContext` only checked `!navigator.onLine` in its `catch` block, and `refreshAccessToken()` called `onAuthFailureCallback()` on network errors as well as `401`/`403`.

4. **Service Worker Dev vs Production Build (`apps/web/vite.config.ts`):**
   - **Symptom:** In `vite` dev mode (`http://localhost:5173`), `navigator.serviceWorker.getRegistrations()` returned `0` (`devOptions: { enabled: false }`), so hard browser reloads (`F5`) while offline returned `net::ERR_INTERNET_DISCONNECTED`.
   - **Remediation / Architecture Note:** Added `preview.proxy` in `vite.config.ts` so the production build (`pnpm build` + `vite preview`) serves `dist/sw.js` (25 precached entries) with `/api` proxying, while client-side SPA navigation works in both dev and production.

---

## 2. Files & Functions Changed

| File | Function / Area | Change |
| --- | --- | --- |
| `apps/web/src/App.tsx` | `queryClient` | Added `networkMode: 'always'` to `defaultOptions.queries` and `defaultOptions.mutations`. |
| `apps/web/src/services/auth.service.ts` | `authService.refresh()` | Coalesced concurrent in-flight refresh calls via `inFlightRefresh`. |
| `apps/web/src/context/AuthContext.tsx` | `initAuth()` | Restores valid `offlineRepo.getLastActiveUserSnapshot()` on network/`502`–`504` errors even when `navigator.onLine === true`. |
| `apps/web/src/services/api-client.ts` | `refreshAccessToken()` | Only invokes `onAuthFailureCallback()` on actual `401`/`403` responses, preserving offline sessions on network/`5xx` errors. |
| `apps/web/vite.config.ts` | `preview.proxy` | Configured `/api` proxy for `vite preview`. |
| `apps/web/src/test/auth.test.tsx` | Test #5 | Added regression test for concurrent `authService.refresh()` coalescing. |

*(Combined with prior commits `d9a6d04`..`9393bb5` covering IndexedDB transactions, queue coalescing, multi-batch dependency sync, `502`–`504` fallback, `401` sync pause, `SalesOrdersPage` local drafts, and `SalesOrderDetailPage` `/sync` link.)*

---

## 3. Real Browser Offline Test Results (Microsoft Edge)

| Scenario | Status | Runtime Evidence |
| --- | --- | --- |
| **Login & Master Data Caching** | `MANUAL_UI_VERIFIED` (`AUTOMATED_TESTED` via Edge E2E) | Logged in as `demo.admin@foodfactory.local` -> loaded `/sales/orders` and `/sales/orders/new` -> IndexedDB `cachedEntities: 511`. |
| **Scenario A: Hard Browser Refresh Offline** | `IMPLEMENTED` (Prod SW) / `BLOCKED` in `vite dev` | `vite build` generated `dist/sw.js` (25 precached entries). In `vite dev` (`:5173`), SW is disabled by `devOptions.enabled: false` so `page.goto`/`page.reload` returns `ERR_INTERNET_DISCONNECTED`; `vite preview` on `:4173` was blocked by API CSRF `FRONTEND_URL=http://localhost:5173`. |
| **Scenario B: Browser Online + Backend `502`** | `MANUAL_UI_VERIFIED` (Edge E2E) | Intercepted `POST /api/v1/sales/orders` with HTTP `502 Bad Gateway` -> form saved locally and navigated to `/sales/orders/6dec5c0c-0516-4db4-8575-9e8a7b912011`. |
| **Scenario C: Offline Order Creation & List/Detail** | `MANUAL_UI_VERIFIED` (Edge E2E) | With `context.setOffline(true)`: created order -> navigated to `/sales/orders/f0ce15c8-b1ba-46d6-a1bd-882ec5c8e06c` -> displayed `LOCAL-DRAFT` and `Pending Sync` -> appeared in `/sales/orders` table (`LOCAL-DRAFT: true`) -> IndexedDB `pendingOperations: [{"opId":"f0ce15c8-b1ba-46d6-a1bd-882ec5c8e06c","status":"PENDING","type":"SALES_ORDER_DRAFT_CREATE"}]`. |
| **Scenario D: Reconnect & Automatic Sync** | `MANUAL_UI_VERIFIED` (Edge E2E) | Restored `context.setOffline(false)` -> automatic sync ran -> IndexedDB updated to `[{"opId":"f0ce15c8-b1ba-46d6-a1bd-882ec5c8e06c","status":"SYNCED","serverEntityId":"586b8f71-2699-456f-a585-742b0d0320ad","err":null}]` -> `LOCAL-DRAFT` removed from list -> `/sales/orders/586b8f71-2699-456f-a585-742b0d0320ad` loaded real `SO-` `DRAFT` order. |
| **RBAC / Business Rule Enforcement on Sync** | `MANUAL_UI_VERIFIED` (Edge E2E) | Verified Salesman without write access to selected warehouse received `CONFLICT` (`"Access denied: You have read-only access to this warehouse facility."`), and invalid UOM conversion received `CONFLICT` (`"No active unit conversion rule found between the specified units."`). |

---

## 4. Quality Gates

- `pnpm typecheck`: **PASS** (0 errors)
- `pnpm lint`: **PASS** (0 errors)
- `pnpm --filter @foodfactory/web test`: **PASS** (43/43 files, 156/156 tests)
- `pnpm --filter @foodfactory/api test -- test/sync.test.ts`: **PASS** (4/4 tests)
- `pnpm build`: **PASS** (`dist/sw.js` with 25 precached entries, 1629.39 KiB)

---

## 5. Exact Reproduction & Verification Commands

```powershell
# 1. Start API and production preview (on port 5173 so CSRF origin matches)
pnpm --filter @foodfactory/api dev
pnpm --filter @foodfactory/web build
pnpm --filter @foodfactory/web preview -- --port 5173

# 2. Run quality gates
pnpm typecheck
pnpm lint
pnpm --filter @foodfactory/web test
pnpm --filter @foodfactory/api test -- test/sync.test.ts
pnpm build
```
