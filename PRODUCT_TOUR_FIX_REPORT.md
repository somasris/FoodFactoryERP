# Product Tour Fix Report (Interactive Spotlight & Multi-Page Guided Navigation)

**Status:**
- `IMPLEMENTED`: Complete
- `TESTED`: Complete (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` passed)
- `MANUAL_UI_VERIFIED`: Pending live interactive browser walkthrough across Desktop/Tablet/Mobile viewports

---

## 1. Root Cause of the Old Behavior

The initial `ProductTourModal.tsx` rendered a centered informational dialog (`fixed inset-0 flex items-end justify-center`) without:
- Navigating to target routes (`useNavigate` / `useLocation`).
- Waiting for or locating actual DOM elements via selectors.
- Scrolling target elements into view (`scrollIntoView`).
- Rendering a spotlight cutout or highlight ring around the target element.
- Positioning an adjacent, non-overlapping tooltip with viewport edge clamping.

## 2. Implementation Approach

Implemented a zero-dependency React 18 Spotlight & Multi-Page Tour engine directly inside `apps/web/src/components/ux/ProductTourModal.tsx` (avoiding external tour library React 18/Vitest compatibility overhead):
- **Target Discovery & Wait:** Uses `MutationObserver` + 50ms polling (up to `2500ms`) for `document.querySelector(step.selector)` after navigating to `step.route`. Automatically skips missing targets safely rather than showing a broken spotlight.
- **Spotlight Cutout:** Renders 4 translucent backdrop panels around the target's `getBoundingClientRect()` (4px padding) so the highlighted control remains bright and unobstructed, surrounded by a glowing `#E8D7AA` highlight ring (`data-testid="product-tour-spotlight"`).
- **Live Position Tracking:** Calls `scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })` and recalculates on `scroll` (capture phase `true`), `resize`, and `ResizeObserver`.
- **Smart Adjacent Tooltip:** Computes non-overlapping placement (`bottom` / `top` / `right` / `left`) clamped to viewport bounds for Desktop, Tablet, and Mobile.
- **Progress Persistence & Controls:** Persists step index in `sessionStorage` (`ff_tour_step_<userId>`) across route transitions, persists completion per user via `PUT /api/v1/preferences/tour`, supports Restart Tour from the user profile menu, and handles `Escape`, `ArrowRight`, and `ArrowLeft` (ignoring editable inputs).

## 3. Actual UI Targets Mapped & Routes Covered

| Step ID | Target Selector | Route | Required Permission |
| :--- | :--- | :--- | :--- |
| `sidebar` | `[data-tour="sidebar"]` | Current route | All roles |
| `command-center` | `[data-tour="command-center"]` | Current route | All roles |
| `dashboard-kpis` | `[data-tour="dashboard-kpis"]` | `/reports/executive` | `analytics.dashboard.read` |
| `dashboard-customizer` | `[data-tour="dashboard-customizer"]` | `/reports/executive` | `analytics.dashboard.read` |
| `saved-views-sales` | `[data-tour="saved-views"]` | `/sales/orders` | `sales.orders.read` |
| `saved-views-production` | `[data-tour="saved-views"]` | `/production/work-orders` | `production.work_orders.read` (when lacking `sales.orders.read`) |
| `notifications` | `[data-tour="notifications"]` | Current route | All roles |
| `activity-timeline` | `[data-tour="activity-timeline"]` | `/activity` | All roles |
| `theme-switcher` | `[data-tour="theme-switcher"]` | Current route | All roles |
| `language-switcher` | `[data-tour="language-switcher"]` | Current route | All roles |
| `user-profile` | `[data-tour="user-profile"]` | Current route | All roles |

## 4. Role-Wise Tour Steps

- **OWNER (10 steps):** `sidebar`, `command-center`, `dashboard-kpis`, `dashboard-customizer`, `saved-views-sales`, `notifications`, `activity-timeline`, `theme-switcher`, `language-switcher`, `user-profile`.
- **ADMIN (10 steps):** Same as OWNER when granted `analytics.dashboard.read` and `sales.orders.read`; dynamically skips any unpermitted module.
- **SALESMAN (8 steps):** `sidebar`, `command-center`, `saved-views-sales`, `notifications`, `activity-timeline`, `theme-switcher`, `language-switcher`, `user-profile`.
- **PRODUCTION (8 steps):** `sidebar`, `command-center`, `saved-views-production`, `notifications`, `activity-timeline`, `theme-switcher`, `language-switcher`, `user-profile`.
- **AUDITOR (9 steps):** `sidebar`, `command-center`, `dashboard-kpis`, `dashboard-customizer`, `notifications`, `activity-timeline`, `theme-switcher`, `language-switcher`, `user-profile`.

## 5. Quality Gates & Test Results

- `pnpm test`:
  - `@foodfactory/api`: **30 test files passed (30), 159 tests passed (159)**
  - `@foodfactory/web`: **35 test files passed (35), 128 tests passed (128)** (including `src/test/phase5-ux.test.tsx` tests 5 & 6 verifying real `data-tour` spotlight rendering, `scrollIntoView`, multi-route navigation, `Previous`/`Next`/`Escape`, and role-based step counts for `SALESMAN`, `PRODUCTION`, and `AUDITOR`, plus `theme-localization.test.tsx` verifying 100% EN/TA key parity).
- `pnpm typecheck`: **Passed** (0 errors).
- `pnpm lint`: **Passed** (0 errors; 9 pre-existing warnings in API, 5 warnings in Web).
- `pnpm build`: **Passed** (API `tsc` + Web `tsc && vite build` + PWA bundle).

## 6. Remaining Limitations & Manual Browser Verification Checklist

- **Limitations:** Automated DOM tests run in `jsdom` with mocked `getBoundingClientRect`; live visual alignment on physical mobile/tablet viewports requires manual browser inspection.
- **Manual Browser Verification Checklist:**
  - [ ] Start tour as `OWNER`, `ADMIN`, `SALESMAN`, `PRODUCTION`, and `AUDITOR` and verify each step navigates to its route and highlights the real target with spotlight.
  - [ ] Scroll and resize window during a step to verify spotlight and tooltip stay aligned.
  - [ ] Test on Desktop, Tablet, and Mobile viewports (verify mobile sidebar opens on Step 1).
  - [ ] Verify Light/Dark themes and English/Tamil translations in the tooltip without text overflow.
