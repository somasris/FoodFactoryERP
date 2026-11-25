# Signup Role Selection & Role-Based Demo Login Verification Report

**Date:** 2026-11-25  
**Status:** `TESTED` (API + Web automated test suites, typecheck, lint, and production build passing; live interactive browser walkthrough pending)

---

## 1. Sign Up Role Selection

- **Frontend (`apps/web/src/routes/LoginPage.tsx`, `apps/web/src/services/auth.service.ts`):**
  - Added a required **Select Your Role** card selector to the Sign Up form with four permitted roles:
    - `ADMIN` — Administration and operational management
    - `SALESMAN` — Sales orders, customers and invoicing
    - `PRODUCTION` — Production planning, execution and inventory operations
    - `AUDITOR` — Read-only access to authorized reports and audit information
  - `OWNER` is never offered as a public signup option.
  - Client-side Zod validation enforces role selection (`Please select a role`) before submission.
- **Backend (`apps/api/prisma/schema.prisma`, `apps/api/src/modules/auth/auth.types.ts`, `auth.service.ts`):**
  - Added `requestedRole` (`requested_role`) column on `users` via migration `20261125150148_add_user_requested_role`.
  - `registerSchema` strictly validates `requestedRole` against `['ADMIN', 'SALESMAN', 'PRODUCTION', 'AUDITOR']` and uses `.strict()` to reject unknown or manipulated fields (`permissions`, `roles`, `warehouseAccess`, `isActive`, `registrationStatus`).
  - Public registration creates an inactive (`isActive: false`), `PENDING_APPROVAL` account with zero granted `userRoles` and zero `warehouseAccess`.
  - `AdminUserService.listUsersPaginated` and `UsersAdminPage.tsx` surface `requestedRole` for administrator review and approval.

---

## 2. Role-Based Demo Login Configuration & Autofill

- **Centralized Config (`apps/api/src/config/demo-accounts.ts`, `apps/api/src/config/env.ts`, `.env.example`):**
  - Added `DEMO_MODE_ENABLED` and `DEMO_*` environment variables with placeholder values in `.env.example`.
  - `isDemoModeEnabled()` returns `true` **only** when `NODE_ENV !== 'production'` and `DEMO_MODE_ENABLED === true`.
  - Configures 5 dedicated demo accounts (`demo.owner@foodfactory.local`, `demo.admin@foodfactory.local`, `demo.salesman@foodfactory.local`, `demo.production@foodfactory.local`, `demo.auditor@foodfactory.local`) separate from production administrator credentials.
  - `apps/api/prisma/seed.ts` idempotently provisions demo accounts only when `isDemoModeEnabled()` is true, and never overwrites existing users' passwords or roles.
- **Endpoint (`GET /api/v1/auth/demo-accounts`):**
  - Returns `{ enabled: false, accounts: [] }` when demo mode is disabled or in production.
  - Returns `{ enabled: true, accounts: [...] }` only in non-production environments with demo mode enabled.
- **Sign In UI (`apps/web/src/routes/LoginPage.tsx`):**
  - Displays a **"Try Demo Accounts"** section below a divider when `demoConfig.enabled` is true, with 5 compact role cards (`OWNER Demo`, `ADMIN Demo`, `SALESMAN Demo`, `PRODUCTION Demo`, `AUDITOR Demo`) and the note `"Demo accounts are provided for evaluation purposes."`
  - Clicking a demo card populates the email and password fields (keeping them editable) and highlights the selected card without auto-submitting; authentication always goes through `POST /api/v1/auth/login` and database role resolution.
  - Hidden entirely when demo mode is disabled or in production builds (`import.meta.env.PROD`).

---

## 3. Quality Gate Results

- **Backend Tests (`pnpm --filter @foodfactory/api test`):** 22 test files passed, 124 tests passed (`signup-rbac.test.ts` covers all 4 allowed signup roles, missing/OWNER/unknown/tampered fields, pending user login block, and `demo-accounts` enabled/disabled/production behavior).
- **Frontend Tests (`pnpm --filter @foodfactory/web test`):** 20 test files passed, 77 tests passed (`signup.test.tsx` covers mandatory role selection, no `OWNER` option, 5 demo autofill cards without auto-submit, and hiding demo section when disabled).
- **Typecheck (`pnpm typecheck`):** Passed with 0 errors.
- **Lint (`pnpm lint`):** Passed with 0 errors and 0 warnings.
- **Build (`pnpm build`):** Passed (`@foodfactory/api` `tsc` + `@foodfactory/web` `tsc && vite build`).

---

## 4. Git Commits

- `3e02b40` — `feat(auth): add secure role selection to signup`
- `f582ab8` — `feat(auth): configure development demo accounts`
- `af4758a` — `feat(auth): add role-based demo credential autofill`
- `5428396` — `test(auth): cover signup roles and demo login`
