# Dashboard TV Mode Verification Report

**Status:** `TESTED` (Automated Frontend tests passing; physical 1080p/768p TV display walkthrough pending `MANUAL_UI_VERIFIED`)

## 1. Fullscreen & Presentation Behavior
- **Component:** `apps/web/src/components/production/FactoryPulseTvView.tsx`
- **Entry/Exit:** Triggered via **TV Mode** button on `/production/factory-pulse` using the browser Fullscreen API with graceful full-viewport overlay fallback when fullscreen is unavailable or denied. Exits cleanly via `Escape` or **Exit TV Mode** button.
- **Rotation & Controls:** Auto-rotates across `Overview`, `Production Activity`, `Material Readiness`, `Quality Monitoring`, and `Attention Required` with configurable interval (`10s` / `15s` / `30s`), `Pause`/`Resume`, and manual `Previous`/`Next` controls (manual stepping auto-pauses rotation).

## 2. Security
- Requires standard JWT authentication and `production.batches.read` permission; inherits the exact factory/warehouse scope of the authenticated session and excludes sensitive financial/customer/admin controls.
