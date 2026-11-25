# FoodFactoryERP – Enterprise Notification System Verification Report

**Date:** 2026-11-25  
**Status:** `TESTED` *(Automated backend, integration, SSE HTTP stream, and frontend tests pass; live browser interactive UI walkthrough pending `MANUAL_UI_VERIFIED`)*

---

## 1. Database Models & Migration

- **Migration:** `apps/api/prisma/migrations/20261125175033_add_enterprise_notifications/migration.sql`
- **Prisma Schema:** `apps/api/prisma/schema.prisma`

### Enums
- `NotificationType`: `INFO`, `SUCCESS`, `WARNING`, `ERROR`, `ACTION_REQUIRED`
- `NotificationCategory`: `SALES`, `INVENTORY`, `PRODUCTION`, `QUALITY`, `FINANCE`, `ADMINISTRATION`, `SYSTEM`
- `NotificationPriority`: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`
- `NotificationOutboxStatus`: `PENDING`, `DELIVERED`, `FAILED`

### Tables
- `notifications` (`Notification`): `id`, `title`, `message`, `type`, `category`, `priority`, `eventKey`, `entityType`, `entityId`, `actionUrl`, `metadata` (JSON), `createdAt`, `expiresAt`. Indexed on `(category, createdAt)`, `(eventKey)`, `(expiresAt)`.
- `user_notifications` (`UserNotification`): `id`, `notificationId`, `userId`, `eventKey`, `isRead`, `readAt`, `isArchived`, `archivedAt`, `createdAt`. Enforces `@@unique([notificationId, userId])` and `@@unique([userId, eventKey])` for DB-level duplicate prevention, plus indexes on `(userId, isRead, isArchived, createdAt)`, `(notificationId)`, and `(createdAt)`.
- `notification_preferences` (`NotificationPreference`): `id`, `userId`, `category`, `inAppEnabled`, `emailEnabled` (future-ready, currently `false`), `updatedAt`. Enforces `@@unique([userId, category])`.
- `notification_outbox` (`NotificationOutbox`): `id`, `notificationId`, `userId`, `payload` (JSON), `status`, `attempts`, `lastError`, `createdAt`, `processedAt`. Indexed on `(status, createdAt)` and `(userId, status)`.
- `notification_alert_states` (`NotificationAlertState`): `id`, `alertKey` (unique), `isActive`, `epoch`, `lastTriggeredAt`, `resolvedAt` for state-based low-stock / zero-stock alert deduplication and re-notification after resolution.

---

## 2. Backend API Endpoints

Mounted at `/api/v1/notifications` in `apps/api/src/routes/index.ts`. All routes require `authenticate` middleware and enforce `req.user.userId` ownership.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Paginated list with `category`, `priority`, `isRead`, `isArchived`, `search`, `fromDate`, `toDate`, `sortBy`, `sortOrder` |
| `GET` | `/api/v1/notifications/unread-count` | Unread, non-archived, non-expired count for authenticated user |
| `GET` | `/api/v1/notifications/:id` | Single notification detail (404 if not owned by user) |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark single notification as read |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all unread notifications as read |
| `PATCH` | `/api/v1/notifications/:id/archive` | Archive single notification |
| `PATCH` | `/api/v1/notifications/archive-all` | Archive all non-archived notifications |
| `GET` | `/api/v1/notifications/preferences` | Retrieve category preferences |
| `PATCH` | `/api/v1/notifications/preferences` | Update `inAppEnabled` category preferences |
| `GET` | `/api/v1/notifications/stream` | Authenticated Server-Sent Events (SSE) stream |

---

## 3. Event-to-Recipient Mapping & RBAC

Implemented in `apps/api/src/modules/notifications/notification-events.service.ts` and `notification.service.ts`:

- **Sales & Invoicing (`SALES`, `FINANCE`, `PRODUCTION`):**
  - Order created -> `salesmanId`, `OWNER`, `ADMIN`.
  - Order submitted -> `sales.orders.approve` holders (warehouse-scoped).
  - Order approved -> `salesmanId`, `sales.orders.confirm` holders (warehouse-scoped).
  - Order rejected -> `salesmanId`.
  - Order confirmed -> `salesmanId`, `sales.orders.fulfill` holders; also notifies `production.demand.read` holders without exposing pricing.
  - Order cancelled / fulfilled -> `salesmanId` + `OWNER`/`ADMIN` or `sales.invoices.create` holders.
  - Invoice created / issued / cancelled -> `salesmanId`, `OWNER`, `ADMIN`.
- **Inventory (`INVENTORY`):**
  - Receipt posted, issue posted, transfer dispatched/received, adjustment posted -> `inventory.read` holders (warehouse-scoped) and `OWNER`/`ADMIN` for adjustments.
  - Low stock & zero stock alerts -> evaluated against `RawMaterial.minStockAlert` and `NOTIFICATIONS_LOW_STOCK_ALERTS` system setting using `NotificationAlertState` (`LOW_STOCK:*`, `ZERO_STOCK:*`) so unchanged shortages do not repeat and resolved-then-retriggered shortages notify again.
- **Production & Quality (`PRODUCTION`, `QUALITY`, `FINANCE`):**
  - Production plan submitted / approved / rejected -> `production.plans.approve` or `createdById` + `production.plans.read` (warehouse-scoped).
  - Work order created / submitted / approved / rejected / released / completed -> `assignedToId`, `production.work_orders.approve` / `read`, `OWNER`/`ADMIN`.
  - Production batch started / paused / completed -> `operatorId`, `OWNER`, `ADMIN`, `production.batches.read` (warehouse-scoped).
  - Costing finalized & high variance (`>= 10%`) -> `OWNER`, `ADMIN`, `production.costing.read`.
  - Quality inspection completed / quarantine released -> `REJECTED` / `QUARANTINED` emit `CRITICAL` priority to `OWNER`/`ADMIN` + `production.quality.read` (warehouse-scoped).
- **Administration & System (`ADMINISTRATION`, `SYSTEM`):**
  - User registered, registration approved, roles updated, account activated/deactivated, role permissions updated, warehouse access granted/revoked, system settings / maintenance mode updated, backup completed/failed (`CRITICAL` on failure), restore request submitted/reviewed -> targeted to affected user + `OWNER`/`ADMIN`.

### Security & Privacy Controls
- Recipients are always resolved server-side from active, `APPROVED` users with active roles.
- Non-global roles (`!OWNER && !ADMIN`) are filtered by `UserWarehouseAccess` when `warehouseId` is present.
- `sanitizeMetadata` redacts keys matching `/password|token|secret|hash|authorization|cookie|privatekey|apikey|credential/i`.
- `AUDITOR` remains strictly read-only; notification links do not bypass `ProtectedRoute` or backend `requirePermissions`.

---

## 4. Real-Time Delivery & Outbox Reliability

- **SSE Service:** `apps/api/src/modules/notifications/notification-sse.service.ts` manages per-user connection sets (capped at 5 per user), sends `retry: 5000`, `event: connected`, and 25s `: heartbeat` keep-alive frames, and cleans up on `req.on('close')` and graceful shutdown (`NotificationSseService.closeAll()`).
- **Outbox Pattern:** `NotificationService.notify` atomically writes `Notification`, `UserNotification`, and `NotificationOutbox` (`PENDING`) inside a Prisma transaction, then flushes SSE events after commit and marks delivered entries `DELIVERED`. On SSE reconnect (`GET /api/v1/notifications/stream`), `deliverPendingOutboxForUser` flushes any `PENDING` entries accumulated while offline, while PostgreSQL remains the source of truth.
- **Frontend SSE Client:** `useNotificationStream` in `apps/web/src/hooks/useNotifications.ts` uses `fetch` streaming with `Authorization: Bearer <token>` (avoiding tokens in URLs) and exponential backoff reconnection (2s to 30s).

---

## 5. Frontend Pages & Components

- **Header Bell & Popover:** `apps/web/src/components/layout/NotificationBell.tsx` mounted in `apps/web/src/components/layout/Navbar.tsx` (unread badge hidden at 0, capped at `99+`, mark all read, empty/loading/error states, permission-checked navigation).
- **Notification Center (`/notifications`):** `apps/web/src/routes/notifications/NotificationsPage.tsx` (All/Unread/Read/Archived tabs, category & priority filters, search, pagination, mark read, archive, detail pane).
- **Preferences (`/notifications/preferences`):** `apps/web/src/routes/notifications/NotificationPreferencesPage.tsx` (category-level In-App toggles; no non-functional email toggle).

---

## 6. Quality Gates & Test Results

Executed from project root on 2026-11-25:

- `pnpm typecheck`: **PASSED** (0 errors across `@foodfactory/api` and `@foodfactory/web`)
- `pnpm lint`: **PASSED** (0 errors; 3 `react-refresh/only-export-components` warnings in `NotificationBell.tsx`)
- `pnpm test`: **PASSED**
  - `@foodfactory/api`: **23 test files passed, 132 tests passed** (including 8 tests in `apps/api/test/notifications.test.ts` covering auth, redaction, multi-recipient delivery, duplicate prevention, user isolation, warehouse scope, preferences, state-alert deduplication, ERP event integration, and live SSE HTTP streaming).
  - `@foodfactory/web`: **22 test files passed, 90 tests passed** (including 5 tests in `apps/web/src/test/notifications.test.tsx` covering bell badge/`99+`, empty state, mark-as-read, permission-gated navigation, Notification Center filters, and Preferences).
- `pnpm build`: **PASSED** (`tsc` + `vite build` succeeded).

---

## 7. Known Limitations

- Email notification delivery (`emailEnabled`) is schema-ready (`false`) and not yet enabled pending SMTP/provider configuration.
- Live browser interactive UI verification (`MANUAL_UI_VERIFIED`) has not yet been performed; automated verification covers API, PostgreSQL, SSE HTTP streaming, and `jsdom` React component suites.
