# FoodFactoryERP – OWNER Demo Role Assignment Fix Report

**Date:** 2026-11-26  
**Branch:** `main`  
**Status:** `TESTED` *(Database repaired via idempotent seed, automated API + Web regression suites and full quality gates passing; live Chrome browser UI verification blocked by missing Chrome DevTools debugging port in this environment)*

---

## 1. Exact Root Cause

1. **Missing `UserRole` Row on `demo_owner`:** In PostgreSQL, the `demo.owner@foodfactory.local` user (`id: 0cdecddf-b1c8-4dfa-b1bc-2c5b969e04d6`, `username: demo_owner`) existed with `isActive: true` and `registrationStatus: 'APPROVED'`, and the `OWNER` role (`id: 3f99f788-1a44-4d91-b92b-258461348c8a`, `code: 'OWNER'`) existed with `isActive: true`, **but `demo_owner` had zero rows in `user_roles` (`userRoles: []`)**.
2. **Incomplete Demo Seed Idempotency (`apps/api/prisma/seed.ts`):** Section `5b. Provision Development Demo Accounts` only created `userRoles` when `!existingDemo`. When `demo_owner` already existed in the database without a `UserRole` record, re-running `pnpm --filter @foodfactory/api db:seed` skipped role verification and left `demo_owner` without an active role assignment.
3. **Authentication Behavior:** `AuthService.resolveActiveRolesAndPermissions` (`apps/api/src/modules/auth/auth.service.ts`) properly filtered `ur => ur.role.isActive` and rejected the login with HTTP `403 Forbidden` (`"Your account does not have an active role assigned. Please contact an administrator."`).

---

## 2. OWNER vs ADMIN Comparison (Pre-Fix DB State)

| Field | `demo.owner@foodfactory.local` (Before Fix) | `demo.admin@foodfactory.local` (Working) |
| :--- | :--- | :--- |
| `isActive` | `true` | `true` |
| `registrationStatus` | `APPROVED` | `APPROVED` |
| Target `Role` (`isActive`) | `OWNER` (`true`) | `ADMIN` (`true`) |
| `userRoles` count | `0` (`[]`) | `1` (`ADMIN`) |
| Login Result | `403 Forbidden` | `200 OK` |

---

## 3. Changes Made

### Database & Seed (`apps/api/prisma/seed.ts`)
- Updated the non-production demo provisioning loop (`isDemoModeEnabled()`) so that when `existingDemo` already exists and `role.isActive` is `true`, it checks `existingDemo.userRoles` and upserts the missing `UserRole` (`{ userId: existingDemo.id, roleId: role.id }`) inside `prisma.$transaction` without overwriting passwords, user IDs, or unrelated accounts.
- Executed `pnpm --filter @foodfactory/api db:seed` twice:
  - First run restored the missing `OWNER` `UserRole` assignment for `demo.owner@foodfactory.local`.
  - Second run completed idempotently with zero duplicate records.

### Authentication & RBAC (`apps/api/src/modules/auth/auth.service.ts`)
- **No bypasses or weakening changes made.** `AuthService.resolveActiveRolesAndPermissions` continues to enforce active `UserRole` + active `Role` validation and returns `403 Forbidden` when no active role exists.

### Regression Tests (`apps/api/test/owner-demo-role.test.ts`)
- Added 5 automated tests verifying:
  1. `demo_owner` exists, is active/approved, and has an active `OWNER` `UserRole`.
  2. `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `GET /api/v1/reports/executive-dashboard` succeed for `OWNER`.
  3. Account with no `UserRole` fails login with `403`.
  4. Inactive `OWNER` role (`isActive: false`) is rejected with `403`.
  5. `ADMIN`, `SALESMAN`, `PRODUCTION`, and `AUDITOR` demo accounts login cleanly without `OWNER` escalation.

---

## 4. Files Modified

- `apps/api/prisma/seed.ts`
- `apps/api/test/owner-demo-role.test.ts`
- `OWNER_ROLE_ASSIGNMENT_FIX_REPORT.md`

---

## 5. Quality Gates & Test Results

Executed from repository root on 2026-11-26:
- `pnpm typecheck`: **PASSED** (`0` errors)
- `pnpm lint`: **PASSED** (`0` errors)
- `pnpm --filter @foodfactory/api test`: **PASSED** (**25 test files passed, 142 tests passed**, including all 5 tests in `test/owner-demo-role.test.ts`)
- `pnpm --filter @foodfactory/web test -- --maxWorkers=2`: **PASSED** (**23 test files passed, 94 tests passed**, including `src/test/role-auth-routing.test.tsx`)
- `pnpm build`: **PASSED** (`tsc` + `vite build` succeeded)

---

## 6. Manual Browser Verification & Limitations

- **Live Browser Verification Status:** Blocked in this environment because the browser automation subagent could not connect to Chrome (`Could not find DevToolsActivePort for chrome at C:\Users\ADMIN\AppData\Local\Google\Chrome\User Data\DevToolsActivePort`).
- **Automated Coverage:** Backend login, `/auth/me`, `/reports/executive-dashboard`, and frontend `LoginPage` role-based redirection (`/reports/executive` for `OWNER`) are verified by `apps/api/test/owner-demo-role.test.ts` and `apps/web/src/test/role-auth-routing.test.tsx`.
