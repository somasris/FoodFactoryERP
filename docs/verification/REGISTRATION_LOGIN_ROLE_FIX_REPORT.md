# Registration Approval Removal & Role-Based Login Verification Report

**Date:** 2026-11-25  
**Status:** `TESTED` (API & Web automated tests, typecheck, lint, and production build passing; live interactive browser walkthrough pending)

---

## 1. Root Cause of Approval Blocking

- `AuthService.register()` in `apps/api/src/modules/auth/auth.service.ts` previously created every new public user with `isActive: false` and `registrationStatus: 'PENDING_APPROVAL'` and zero `userRoles`, forcing an administrator to manually approve the registration before sign-in was allowed.
- `LoginPage.tsx` previously rendered a `"Registration Submitted — pending administrator approval"` blocking screen instead of returning the user to Sign In.

---

## 2. Changes Implemented

### Backend (`apps/api/src/modules/auth/auth.service.ts`, `auth.controller.ts`)
- **Immediate Activation & DB Role Assignment:** `AuthService.register()` now:
  - Normalizes email (`trim().toLowerCase()`) and rejects duplicate emails (`409`).
  - Validates `requestedRole` against `['ADMIN', 'SALESMAN', 'PRODUCTION', 'AUDITOR']` (strictly rejecting `OWNER`, unknown roles, and extra fields like `permissions`, `roles`, `warehouseAccess`, `isActive`, `registrationStatus` with `400`).
  - Looks up the existing active `Role` record in PostgreSQL and creates the `User` with `isActive: true`, `registrationStatus: 'APPROVED'`, `requestedRole: role.code`, and a `UserRole` link to that `Role`.
  - Hashes passwords with Argon2id and never returns `passwordHash` or tokens in the registration response.
  - Returns message `"Account created successfully. You can now sign in."` (`201`).
- **Preserved Security Guards:**
  - Administrative deactivation (`isActive: false`) and rejected accounts (`registrationStatus === 'REJECTED'`) remain blocked in `login()`, `refresh()`, `getCurrentUser()`, and `authenticate` middleware.
  - Existing `OWNER` account, roles, and last-active-OWNER / self-lockout safeguards remain untouched.

### Frontend (`apps/web/src/routes/LoginPage.tsx`, `apps/web/src/services/auth.service.ts`)
- Removed the `"pending administrator approval"` waiting screen.
- After successful registration, `LoginPage` switches to Sign In, prefills the registered email in `Username or Email`, and displays `"Account created successfully. You can now sign in."` along with the assigned role badge.
- Role-based dashboard redirection after Sign In continues to resolve from the database-assigned role (`OWNER` → `/reports/executive`, `ADMIN` → `/admin/organization`, `SALESMAN` → `/sales/dashboard`, `PRODUCTION` → `/production/execution`, `AUDITOR` → `/admin/governance`).
- All 5 Demo Login options remain active and unaffected in development mode.

---

## 3. Quality Gate Results

- **Backend Tests (`pnpm --filter @foodfactory/api test`):** 22 test files passed, 124 tests passed (`signup-rbac.test.ts` verifies immediate activation, DB `UserRole` assignment for `ADMIN`, `SALESMAN`, `PRODUCTION`, `AUDITOR`, immediate sign-in, `OWNER`/unknown/tampered field rejection, and preserved RBAC restrictions).
- **Frontend Tests (`pnpm --filter @foodfactory/web test`):** 20 test files passed, 78 tests passed (`signup.test.tsx` verifies redirect to Sign In with prefilled email and `"Account created successfully. You can now sign in."` banner).
- **Typecheck (`pnpm typecheck`):** Passed with 0 errors.
- **Lint (`pnpm lint`):** Passed with 0 errors and 0 warnings.
- **Build (`pnpm build`):** Passed (`@foodfactory/api` `tsc` + `@foodfactory/web` `tsc && vite build`).

---

## 4. Git Commits

- `6929be0` — `fix(auth): remove mandatory registration approval and assign roles`
- `1e14650` — `fix(auth): redirect signup to sign-in with prefilled email`
- `fb8a8a9` — `test(auth): cover registration and role-based login`
