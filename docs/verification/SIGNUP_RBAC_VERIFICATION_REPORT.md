# FoodFactory ERP – Public Sign Up & Secure RBAC Verification Report

**Feature:** Public Sign Up / User Registration & Pending Approval RBAC Workflow  
**Status:** `TESTED` *(Automated API & Web test suites, typecheck, lint, and production build pass; manual browser UI walkthrough pending)*  
**Date:** 2026-11-25  

---

## 1. Architecture & Account Activation Model

Selected **Option A – Pending Approval**:
- **Schema (`apps/api/prisma/schema.prisma`):** Added `enum UserRegistrationStatus { PENDING_APPROVAL APPROVED REJECTED }` and `User.registrationStatus` (`@default(APPROVED)` so existing seeded/admin-created users remain unaffected). Applied migration `20261125135648_public_signup_pending_approval`.
- **Public Registration (`POST /api/v1/auth/register`):**
  - Strictly validates `{ name, email, password, phoneNumber? }` via Zod `.strict()`, rejecting any unexpected or forged properties (`role`, `roles`, `permissions`, `isActive`, `registrationStatus`, `warehouseAccess`).
  - Normalizes email (trim + lowercase), checks duplicates (`409 Conflict`), enforces `validatePasswordPolicy`, hashes with Argon2id (`hashPassword`), and creates the `User` with `isActive: false`, `registrationStatus: 'PENDING_APPROVAL'`, and zero roles/warehouse access inside `prisma.$transaction`.
  - Records an immutable `AuditLog` (`CREATE`, `UserRegistration`) with no plaintext passwords, hashes, or tokens.
  - Protected by Express rate limiting (`registerLimiter`: 10 requests per 15 minutes).
- **Login Enforcement (`AuthService.login`):**
  - Blocks `PENDING_APPROVAL` and `REJECTED` accounts with `403 Forbidden` and logs `LOGIN_FAILED` in `AuditLog`.
- **Admin Approval Workflow (`POST /api/v1/admin/users/:id/review-registration`):**
  - Protected by `administration.users.manage` permission (`OWNER` / `ADMIN` only; `AUDITOR` and operational roles receive `403 Forbidden`).
  - Enforces `OWNER` escalation guard: `ADMIN` cannot assign the `OWNER` role.
  - Approving sets `isActive: true`, `registrationStatus: 'APPROVED'`, assigns selected roles (default `SALESMAN`), and records an `APPROVE` `AuditLog`. Rejecting keeps `isActive: false`, sets `registrationStatus: 'REJECTED'`, and records a `REJECT` `AuditLog`.

---

## 2. Frontend Implementation

- **Sign Up UI (`apps/web/src/routes/LoginPage.tsx` & `/signup` route in `apps/web/src/routes/router.tsx`):**
  - Responsive Sign In | Sign Up tabs, Full Name, Email Address, Phone Number (optional), Password, Confirm Password, show/hide password toggles, client-side Zod validation, loading state, duplicate-submit guard, server error banner, and pending-approval confirmation screen.
  - Redirects already-authenticated users to `/`.
- **Admin Integration (`apps/web/src/routes/admin/UsersAdminPage.tsx`):**
  - Added Registration Status filter (`All Registrations`, `Pending Approval`, `Approved`, `Rejected`), `Pending Approval` / `Rejected` status badges, and a Review Registration modal for `PENDING_APPROVAL` users.

---

## 3. Automated Verification Results

Executed across the full monorepo after final edits:

| Check | Command | Result |
| :--- | :--- | :--- |
| TypeScript | `pnpm typecheck` | Passed (`@foodfactory/api` + `@foodfactory/web`) |
| ESLint | `pnpm lint` | Passed (`@foodfactory/api` + `@foodfactory/web`) |
| Production Build | `pnpm build` | Passed (`tsc` + `vite build`) |
| API Tests | `pnpm --filter @foodfactory/api test` | **22 files, 118 tests passed** (includes 8 tests in `test/signup-rbac.test.ts`) |
| Web Tests | `pnpm --filter @foodfactory/web test` | **18 files, 63 tests passed** (includes 5 tests in `src/test/signup.test.tsx`) |
