# FoodFactoryERP — Brand Identity & Application-Wide Logo Replacement Report

**Date:** 2026-11-27  
**Branch:** `main`  
**Scope:** Complete symbol-only brand identity redesign and application-wide replacement across Frontend UI, PWA/Favicon, PDF exports, and Excel workbooks.

---

## 1. Final Logo Design Description

- **Concept:** *Precision Grain & Industrial Foundation* — an original, minimal geometric vector symbol (`64x64` integer `viewBox`) combining:
  - **Rounded Hexagonal Frame:** Represents industrial precision, structural reliability, and modular enterprise ERP workflows.
  - **Symmetrical Twin Grain/Leaf Blades:** Represents agricultural freshness, raw food ingredients, and sustainable food manufacturing.
  - **Central Gold Precision Kernel:** Represents quality assurance, batch traceability, and core operational value.
  - **Horizontal Base Bar:** Grounds the organic grain form in industrial stability.
- **Strict Symbol-Only Compliance:** Contains **zero** words, letters, initials, numbers, taglines, gradients, or drop shadows. Works cleanly in single-color monochrome and remains sharp at 16–24px as well as 512px.

---

## 2. Asset Files Created

| Asset Path | Purpose | Status |
| --- | --- | --- |
| `apps/web/public/brand/foodfactory-symbol.svg` | Primary vector symbol (`#245C3A`, `#3D7651`, `#C39A45`, transparent bg) | IMPLEMENTED |
| `apps/web/public/brand/foodfactory-symbol-white.svg` | White vector symbol (`#FFFFFF`, `#E8D7AA`, transparent bg) for dark surfaces | IMPLEMENTED |
| `apps/web/public/brand/foodfactory-symbol-mono.svg` | Single-color monochrome symbol (`#17452C`) for print/single-ink contexts | IMPLEMENTED |
| `apps/web/public/brand/foodfactory-symbol-256.png` | 256×256 transparent PNG rasterized from primary SVG | IMPLEMENTED |
| `apps/api/assets/brand/foodfactory-symbol-256.png` | Backend-local 256×256 transparent PNG for PDF/Excel runtime resolution | IMPLEMENTED |
| `apps/web/public/icons/icon.svg` | Rounded-square `#245C3A` badge SVG favicon | IMPLEMENTED |
| `apps/web/public/icons/icon-192.png` | 192×192 PWA app icon | IMPLEMENTED |
| `apps/web/public/icons/icon-512.png` | 512×512 PWA app icon | IMPLEMENTED |
| `apps/web/public/icons/icon-maskable-512.png` | 512×512 full-bleed `#245C3A` maskable icon (60% safe zone) | IMPLEMENTED |
| `apps/web/public/icons/apple-touch-icon.png` | 180×180 Apple touch icon (opaque `#245C3A` background) | IMPLEMENTED |

---

## 3. Logo Colour Variants

1. **Primary (`default`):** Forest Green `#245C3A` + Secondary Green `#3D7651` + Gold Accent `#C39A45` (light surfaces).
2. **White (`white`):** White `#FFFFFF` + Warm Gold `#E8D7AA` (dark surfaces: login header `#245C3A`, mobile sidebar `#173F2B`, TV view `#103B28`, dark mode).
3. **Auto (`auto`):** Theme-reactive Tailwind fills (`#245C3A`/`#C39A45` in light mode, `#FFFFFF`/`#E8D7AA` in dark mode).
4. **Monochrome (`mono`):** Single-color `currentColor` / `#17452C` for print and single-color contexts.

---

## 4. Frontend Logo Replacements

- **Centralized Component:** `apps/web/src/components/common/AppLogo.tsx` (`IMPLEMENTED`, `AUTOMATED_TESTED`)
  - Supports `variant` (`default`, `white`, `mono`, `auto`), `size` (`xs`..`xl`), `decorative` (`aria-hidden="true"`), and optional external `showWordmark` text.
- **Navbar (`apps/web/src/components/layout/Navbar.tsx`):** Replaced `<Factory />` icon badge with `<AppLogo variant="auto" size="md" decorative />` beside external `FoodFactory ERP` text. (`IMPLEMENTED`)
- **Authentication (`apps/web/src/routes/LoginPage.tsx`):** Replaced `<Factory />` icon on the `#245C3A` header with `<AppLogo variant="white" size="md" decorative />`. (`IMPLEMENTED`)
- **Mobile Sidebar (`apps/web/src/components/layout/Sidebar.tsx`):** Added `<AppLogo variant="white" size="sm" decorative />` in the mobile drawer header. (`IMPLEMENTED`)
- **Live Factory Pulse TV (`apps/web/src/components/production/FactoryPulseTvView.tsx`):** Replaced `<Activity />` icon in the TV header with `<AppLogo variant="white" size="md" decorative />`. (`IMPLEMENTED`)

---

## 5. PDF Templates Updated

All backend PDF generators now resolve the official brand PNG via `resolveOfficialLogoPath()` in `apps/api/src/utils/export/export-theme.ts` (resolving `apps/api/assets/brand/foodfactory-symbol-256.png` in both `tsx` dev and compiled `dist/` production):

1. **Standardized Report PDF Exporter (`apps/api/src/utils/export/pdf-exporter.ts`):** Covers Sales Reports, Receivables & Ageing, Customer Payment Receipts, Purchase Register, GST/Compliance Reports, Inventory & Valuation, Stock Movement, Production Plan vs Actual, Costing, Yield, Variance, Quality, and Audit Reports. (`IMPLEMENTED`, `AUTOMATED_TESTED`)
2. **Sales Invoice PDF (`apps/api/src/modules/sales/sales-invoice-pdf.service.ts`):** Added `32×32` official symbol in the seller header block, shifting company legal details cleanly to avoid overlap. (`IMPLEMENTED`, `AUTOMATED_TESTED` via `sales-invoices.test.ts`)
3. **Credit Note PDF (`apps/api/src/modules/sales/credit-note-pdf.service.ts`):** Added `30×30` official symbol at top-left `(36, 36)` beside the centered `GST CREDIT NOTE` header. (`IMPLEMENTED`)

---

## 6. Excel & CSV Templates

- **Excel (`apps/api/src/utils/export/excel-exporter.ts`):** Added `workbook.addImage` + `sheet.addImage` (`36×36` PNG) anchored in the top-right header area (`row: 0.15`) above `headerRowNumber`, preserving all column widths, auto-filters, and frozen panes. (`IMPLEMENTED`, `AUTOMATED_TESTED` via `export-standardization.test.ts`)
- **CSV (`apps/api/src/utils/export/csv-exporter.ts`):** Unchanged; preserves clean UTF-8 BOM RFC 4180 CSV without fake image data. (`AUTOMATED_TESTED`)

---

## 7. PWA & Favicon Changes

- `apps/web/index.html`: Updated favicon to `/icons/icon.svg?v=2` and Apple touch icon to `/icons/apple-touch-icon.png?v=2` (`180×180`). (`IMPLEMENTED`)
- `apps/web/vite.config.ts`: Updated `includeAssets` and `manifest.icons` to include `icon-192.png`, `icon-512.png` (`any`), `icon-maskable-512.png` (`maskable`), and `icon.svg`. Workbox `cleanupOutdatedCaches: true` invalidates old precached assets on build. (`IMPLEMENTED`, `AUTOMATED_TESTED` via `pnpm build`)
- `apps/web/public/offline.html`: Embedded inline symbol-only SVG above the Offline Mode badge for instant zero-network rendering. (`IMPLEMENTED`)

---

## 8. Old Assets Removed / Replaced

- Replaced the previous factory-building SVG in `apps/web/public/icons/icon.svg` and regenerated `icon-192.png` and `icon-512.png`.
- Replaced `apps/web/public/icons/icon-192.png` as the backend export logo path in `export-theme.ts` with `foodfactory-symbol-256.png`.
- Verified via `git grep` that no `<Factory />` brand logo usages remain in layout, authentication, or TV header components.

---

## 9. Tests & Quality Gate Results

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | PASS | Both `@foodfactory/api` and `@foodfactory/web` (`tsc --noEmit`) passed with 0 errors. |
| `pnpm lint` | PASS | 0 errors (pre-existing warnings only in unrelated files). |
| `pnpm --filter @foodfactory/web test` | PASS | 43/43 test files, 152/152 tests passed (including new `app-logo.test.tsx`). |
| `pnpm --filter @foodfactory/api test` | PARTIAL (38/39 files, 194/195 tests) | `export-standardization.test.ts`, `sales-invoices.test.ts`, `reports-phase4-3.test.ts`, `compliance-phase4-2.test.ts`, and `production-reports.test.ts` all passed. 1 unrelated failure in `test/p1-collection-seed.test.ts:346` (`expected '6840.00' to be '1250.00'`, pre-existing DB state in monthly collection summary). |
| `pnpm build` | PASS | Both `@foodfactory/api` and `@foodfactory/web` built cleanly (`dist/manifest.webmanifest`, `dist/sw.js` with 25 precached entries). |
| Production dist logo resolution | PASS | `node -e "require('./apps/api/dist/utils/export/export-theme.js').resolveOfficialLogoPath()"` resolved `apps/api/assets/brand/foodfactory-symbol-256.png`. |

---

## 10. Manual UI Verification Status

- **Rasterized Asset Visual Inspection (`MANUAL_UI_VERIFIED`):** Inspected `foodfactory-symbol-256.png` and `icon-192.png` directly; verified crisp geometry, symmetrical proportions, transparent vs `#245C3A` background, and zero text/artifacts.
- **Live Browser Interactive Inspection:** Not performed in a live browser session (verified via JSDOM unit tests, production Vite build, and static asset inspection).

---

## 11. Remaining References / Blockers

- **No remaining old logo references** in active application code.
- **Unrelated test blocker:** `apps/api/test/p1-collection-seed.test.ts:346` fails due to pre-existing seeded/test payment records in the local database (`6840.00` vs `1250.00`), unrelated to branding.

---

## 12. Git Commit Hashes

- `80785c7` — `feat(branding): introduce new symbol-only FoodFactoryERP identity`
- `bc7cd82` — `feat(web): replace application logos across frontend`
- `3e14908` — `feat(reports): update PDF and document branding`
- `483cdab` — `feat(pwa): update favicon and installable app icons`
- `5129a93` — `test(branding): verify application-wide logo integration`
- *(Pending final docs commit for this report)*
