# FoodFactoryERP – Demo Login Buttons Fix Report

**Date:** 2026-11-27  
**Branch:** `main`  

---

## 1. Exact Root Cause

1. **Frontend Production Build Gate ([auth.service.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/services/auth.service.ts#L191-L206)):**
   `authService.getDemoAccounts()` had `if (import.meta.env.PROD || import.meta.env.VITE_DEMO_MODE === 'false') return { enabled: false, accounts: [] };`, which unconditionally suppressed the demo login section in all production builds (`pnpm build` / deployed production).
2. **Backend Production Environment Gate ([demo-accounts.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/src/config/demo-accounts.ts#L15-L26)):**
   `isDemoModeEnabled()` had `if (env.NODE_ENV === 'production') return false;`, which forced `GET /api/v1/auth/demo-accounts` to return `{ enabled: false, accounts: [] }` in production even when `DEMO_MODE_ENABLED=true`.
3. **One-Click UX & Loading/Error Handling ([LoginPage.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/routes/LoginPage.tsx)):**
   Demo buttons previously only autofilled the form without triggering authentication, had no loading spinner or concurrent-click guard, and did not navigate immediately after login.

---

## 2. Files Changed & Fix Implemented

- [apps/api/src/config/demo-accounts.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/src/config/demo-accounts.ts): Updated `isDemoModeEnabled()` so demo mode is enabled by default in both `development` and demo `production` deployments unless explicitly disabled via `DEMO_MODE_ENABLED=false` (still disabled by default in `test` unless `DEMO_MODE_ENABLED=true`).
- [apps/web/src/services/auth.service.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/services/auth.service.ts): Removed `import.meta.env.PROD ||` so `getDemoAccounts()` queries `/auth/demo-accounts` in both dev and production builds unless `VITE_DEMO_MODE === 'false'`.
- [apps/web/src/routes/LoginPage.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/routes/LoginPage.tsx): Added `Quick Demo Sign-In` section with accessible buttons (`Owner Demo`, `Admin Demo`, `Salesman Demo`, `Production Demo`, `Auditor Demo`), loading spinner (`Loader2`), disabled state during login to prevent concurrent requests, error alert display on failure, and immediate role-based dashboard redirect on success.
- [apps/api/test/signup-rbac.test.ts](file:///d:/somasri/projects/FoodFactoryERP/apps/api/test/signup-rbac.test.ts), [apps/web/src/test/signup.test.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/test/signup.test.tsx), [apps/web/src/test/role-auth-routing.test.tsx](file:///d:/somasri/projects/FoodFactoryERP/apps/web/src/test/role-auth-routing.test.tsx): Updated automated tests for production demo visibility, one-click authentication, and `DEMO_MODE_ENABLED=false` opt-out.

---

## 3. Authentication & Quality Gate Verification

- **Production-mode `/api/v1/auth/demo-accounts` + Login for All 5 Roles (`AUTOMATED_TESTED`):**
  - `OWNER` (`demo.owner@foodfactory.local`): `200 OK`, `roles: ['OWNER']`
  - `ADMIN` (`demo.admin@foodfactory.local`): `200 OK`, `roles: ['ADMIN']`
  - `SALESMAN` (`demo.salesman@foodfactory.local`): `200 OK`, `roles: ['SALESMAN']`
  - `PRODUCTION` (`demo.production@foodfactory.local`): `200 OK`, `roles: ['PRODUCTION']`
  - `AUDITOR` (`demo.auditor@foodfactory.local`): `200 OK`, `roles: ['AUDITOR']`
- `pnpm typecheck`: **PASS**
- `pnpm lint`: **PASS** (0 errors)
- `pnpm --filter @foodfactory/web test -- src/test/role-auth-routing.test.tsx src/test/signup.test.tsx`: **PASS** (16/16)
- `pnpm --filter @foodfactory/api test -- test/signup-rbac.test.ts test/owner-demo-role.test.ts`: **PASS**
- `pnpm build`: **PASS**

---

## 4. Remaining Deployment Steps

- Ensure the deployed production API has the 5 demo accounts seeded (`pnpm --filter @foodfactory/api db:seed` with `DEMO_MODE_ENABLED` not set to `false`).
- To disable demo login in a non-demo production environment, set `DEMO_MODE_ENABLED=false` (backend) and/or `VITE_DEMO_MODE=false` (frontend).
