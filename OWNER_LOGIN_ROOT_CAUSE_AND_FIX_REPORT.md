# OWNER Login Root Cause and Permanent Fix Report

**Status:**
- `ROOT_CAUSE_IDENTIFIED`
- `FIX_IMPLEMENTED`
- `AUTOMATED_TESTED`
- `MANUAL_LOGIN_VERIFIED` — Pending live interactive browser sign-in walkthrough (Supertest API + React Testing Library flows verified end-to-end)

---

## 1. Exact Root Cause

Both environment-configured OWNER login and OWNER demo login failed with HTTP `403` and:
> `"Your account does not have an active role assigned. Please contact an administrator."`

Database inspection confirmed that **every `UserRole` assignment for the `OWNER` role had been deleted from PostgreSQL** (`0` `UserRole` rows for `OWNER`, while `ADMIN`, `SALESMAN`, `PRODUCTION`, and `AUDITOR` each had 45–48 rows).

Tracing the codebase identified **two backend test suites** that ran `prisma.userRole.deleteMany({ where: { role: { code: 'OWNER' }, ... } })` against the shared PostgreSQL database in order to isolate the "last active OWNER protection" invariant:
1. `apps/api/test/users.test.ts` (`beforeAll`, test 11, test 12, and `afterAll`)
2. `apps/api/test/rbac.test.ts` (test 7 and `afterAll`)

Both suites deleted **all** external `OWNER` `UserRole` assignments (including `demo_owner` and the `INITIAL_OWNER_EMAIL` account), and their `afterAll` hooks only attempted to restore a single hardcoded user matching `username: 'owner'` — which did not match `demo_owner` (`demo.owner@foodfactory.local`) or the configured `INITIAL_OWNER_EMAIL` user (`username: 'admin'`). Every `pnpm test` run silently stripped `OWNER` role assignments from both accounts.

Additionally, `apps/api/prisma/seed.ts` had minor hardening gaps:
- `INITIAL_OWNER_EMAIL` lookup did not normalize case/whitespace on query, and did not ensure `isActive: true` / `registrationStatus: 'APPROVED'` on an existing user.
- Core role upserts did not explicitly ensure `isActive: true` on update.

## 2. Root Cause Classification Checklist

| Potential Cause | Result | Details |
| :--- | :--- | :--- |
| Missing database user | **No** | Both `INITIAL_OWNER_EMAIL` user and `demo_owner` existed in `users`. |
| Incorrect email mapping | **No** | Emails matched configuration; `AuthService.login` uses case-insensitive lookup. |
| Missing OWNER role | **No** | Canonical `OWNER` role existed with 139 permissions. |
| Inactive OWNER role | **No** | `OWNER.isActive` was `true`. |
| Missing/inactive user-role assignment | **YES (Primary)** | `users.test.ts` and `rbac.test.ts` deleted all `OWNER` `UserRole` rows on every test run without restoring them. |
| Incorrect authentication query | **No** | `AuthService.login`, `refresh`, `getCurrentUser`, and `authenticate` middleware correctly query `userRoles` -> `role` -> `permissions`. |
| Password verification | **No** | Argon2id verification works as expected. |
| JWT/session handling | **No** | Access/refresh token generation and rotation work as expected. |
| Frontend demo configuration | **No** | `LoginPage.tsx` fetches `/api/v1/auth/demo-accounts` and autofills configured credentials. |
| Route guard or permission resolution | **No** | `AuthContext`, `ProtectedRoute`, `canAccessPath`, and `getDefaultDashboardPath` resolve `OWNER` to `/reports/executive`. |

## 3. Files Modified

- `apps/api/test/users.test.ts`: Snapshots all non-test `OWNER` `userId`s before temporarily isolating last-owner tests and restores all preserved `OWNER` `UserRole` assignments in `afterAll`.
- `apps/api/test/rbac.test.ts`: Snapshots and restores all other `OWNER` `UserRole` assignments in `finally` immediately after test 7 and in `afterAll`.
- `apps/api/prisma/seed.ts`: Hardens idempotent `OWNER` bootstrap (`isActive: true` on core roles, case-insensitive `INITIAL_OWNER_EMAIL`/`username` lookup, ensuring `isActive: true` and `registrationStatus: 'APPROVED'` without overwriting existing password hashes).
- `apps/api/test/owner-demo-role.test.ts`: Added tests 6 & 7 covering environment-configured OWNER login, `/api/v1/auth/me`, `/api/v1/admin/users`, invalid password/unknown email (`401`), and public signup `OWNER` rejection (`400`).
- `apps/web/src/test/role-auth-routing.test.tsx`: Added tests 7 & 8 covering OWNER demo button autofill, masked password field, redirect to `/reports/executive`, backend error display on failed login, and full `OWNER` `Sidebar` rendering.
- `OWNER_LOGIN_ROOT_CAUSE_AND_FIX_REPORT.md`: This report.

## 4. Database Changes

- No schema migration was required.
- Executed `pnpm --filter @foodfactory/api db:seed` (idempotent repair) which verified the `INITIAL_OWNER_EMAIL` account with `OWNER` role and restored the missing `OWNER` `UserRole` assignment for `demo.owner@foodfactory.local` without modifying any password hashes or unrelated records.
- Verified post-`pnpm test` PostgreSQL state: `demo_owner` and `INITIAL_OWNER_EMAIL` retain active `OWNER` `UserRole` rows (`4` `OWNER` assignments total).

## 5. Quality Gates & Test Results

- `pnpm --filter @foodfactory/api db:seed`: **Passed** (idempotent repair verified).
- `pnpm test`:
  - `@foodfactory/api`: **29 test files passed (29), 155 tests passed (155)**
  - `@foodfactory/web`: **34 test files passed (34), 121 tests passed (121)**
- `pnpm typecheck`: **Passed** (0 errors across API and Web).
- `pnpm lint`: **Passed** (0 errors; 9 pre-existing warnings in API, 4 pre-existing warnings in Web).
- `pnpm build`: **Passed** (API `tsc` + Web `tsc && vite build` + PWA bundle).

## 6. End-to-End Verification Confirmation

- **Environment-configured OWNER login:** Verified via Supertest (`test/owner-demo-role.test.ts` test 6) returning `200`, `OWNER` role in login, `/api/v1/auth/me`, and `/api/v1/admin/users`.
- **OWNER demo login:** Verified via Supertest (`test/owner-demo-role.test.ts` test 2) returning `200`, `/api/v1/auth/me`, `/api/v1/reports/executive-dashboard`, and frontend autofill + redirect (`role-auth-routing.test.tsx` test 7).
- **Other roles (`ADMIN`, `SALESMAN`, `PRODUCTION`, `AUDITOR`):** Verified in `test/owner-demo-role.test.ts` test 5 and `test/rbac.test.ts`.

## 7. Remaining Blockers

- None for automated verification. Manual interactive browser sign-in walkthrough can be performed on running dev servers (`pnpm dev`).
