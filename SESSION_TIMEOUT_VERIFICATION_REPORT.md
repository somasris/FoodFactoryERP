# Session Timeout & Inactivity Termination Verification Report

**Status:** `TESTED` (`MANUAL_UI_VERIFIED` pending live multi-tab browser walkthrough)  
**Branch:** `main`  
**Date:** 2026-11-26  

---

## 1. Existing Authentication Architecture & Gaps Identified

- **Existing State:** Access tokens (`15m` JWT) were verified statelessly in `authenticate` (`apps/api/src/middleware/auth.middleware.ts`) against `User` and `UserRole`, while `RefreshToken` persisted refresh token families. There was no server-side inactivity expiration or per-session revocation check for active JWTs, and no frontend inactivity warning/countdown or cross-tab session synchronization.

---

## 2. Timeout Configuration & Defaults

- **Authoritative Backend Policy (`SessionService.getPolicy` in `apps/api/src/modules/auth/session.service.ts`):**
  - Default inactivity timeout: **`15` minutes** (`SESSION_INACTIVITY_TIMEOUT_MINUTES`, validated `5–120`).
  - Default warning window: **`2` minutes** before expiry (`SESSION_WARNING_MINUTES`, validated `1–min(10, timeout-1)`).
  - Default absolute max lifetime: **`12` hours** (`SESSION_ABSOLUTE_MAX_HOURS`, validated `1–72`).
  - Configurable via `SystemConfig` by authorized administrators; backend remains the sole authority.

---

## 3. Backend Session Enforcement & API Changes

- **Database (`apps/api/prisma/schema.prisma`, migration `20261126173407_add_user_sessions_inactivity_timeout`):**
  - Added `UserSession` (`id`, `userId`, `family`, `ipAddress`, `userAgent`, `lastActivityAt`, `inactivityExpiresAt`, `absoluteExpiresAt`, `isRevoked`, `revokedAt`, `revokedById`, `revocationReason`).
- **Authentication & Middleware:**
  - `AuthService.login` creates a `UserSession` in the same transaction as `RefreshToken`, embeds `sessionId` into `TokenPayload`, and logs `SESSION_CREATED`.
  - `authenticate` (`auth.middleware.ts`) validates `UserSession` (`!isRevoked`, `inactivityExpiresAt > now`, `absoluteExpiresAt > now`) on every authenticated request carrying `sessionId`, returning `401` (`SESSION_EXPIRED` / `SESSION_REVOKED`) and logging `SESSION_EXPIRED` atomically.
  - `AuthService.refresh` enforces `UserSession` validity before rotating tokens and caps extension at `absoluteExpiresAt`.
  - `AuthService.logout` and `AdminUserService.resetPassword` revoke both `RefreshToken` and `UserSession` records.
- **Endpoints:**
  - `GET /api/v1/auth/session`: returns authoritative policy & timestamps (`serverTime`, `inactivityExpiresAt`, `absoluteExpiresAt`).
  - `POST /api/v1/auth/session/extend`: validates active session, extends `inactivityExpiresAt` (capped by `absoluteExpiresAt`), rotates `accessToken`, and logs `SESSION_EXTENDED`.
  - `GET /api/v1/auth/sessions` & `POST /api/v1/auth/sessions/:sessionId/revoke`: user self-service session listing & revocation.
  - `GET /api/v1/admin/users/:id/sessions` (`administration.users.read`, read-only for `AUDITOR`) & `POST /api/v1/admin/sessions/:sessionId/revoke` (`administration.users.manage`).

---

## 4. Frontend Inactivity Tracking, Warning Dialog & Multi-Tab Sync

- **Centralized Manager ([SessionTimeoutManager.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/components/auth/SessionTimeoutManager.tsx)):**
  - Mounted once inside `AppShell.tsx` across all authenticated routes.
  - Tracks throttled (`1000ms`) meaningful user events (`mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`) only when the tab is visible and the warning dialog is closed.
  - Background API polling does **not** reset inactivity.
  - Re-validates session status with the backend on `visibilitychange` when resuming from a hidden/suspended state.
  - Displays an accessible warning dialog (`role="alertdialog"`, Light/Dark & English/Tamil) at `timeout - warning` (`13m` default) with a live `MM:SS` countdown, **Continue Session** (closes only on backend confirmation), and **Logout Now**.
  - On expiry, cancels/clears TanStack Query cache, revokes session, redirects to `/login`, and displays `"Your session expired due to inactivity. Please sign in again."` on `LoginPage.tsx`.
- **Multi-Tab Sync ([session-sync.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/services/session-sync.ts)):**
  - Uses `BroadcastChannel('ff_session_sync')` (with `localStorage` `storage` event fallback) to synchronize `LOGOUT`, `SESSION_EXPIRED`, and `SESSION_EXTENDED` across tabs without ever sharing access or refresh tokens.

---

## 5. Verification Results

- `pnpm typecheck`: Passed (`0` errors across `@foodfactory/api` and `@foodfactory/web`).
- `pnpm lint`: Passed (`0` errors across `@foodfactory/api` and `@foodfactory/web`).
- `pnpm --filter @foodfactory/api test`: `34` test files (`175` tests) passed, including `test/session-timeout.test.ts` (`3` tests) and `test/auth.test.ts` (`18` tests).
- `pnpm --filter @foodfactory/web test`: `40` test files (`140` tests) passed, including `src/test/session-timeout.test.tsx` (`2` fake-timer tests) and `src/test/theme-localization.test.tsx` (`2` tests).
- `pnpm build`: Passed (API `tsc`, Web `tsc && vite build`, PWA service worker).
- **Manual Verification (`MANUAL_UI_VERIFIED`):** Pending live multi-tab browser & sleep/wake walkthrough.
