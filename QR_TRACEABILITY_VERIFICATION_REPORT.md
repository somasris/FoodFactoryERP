# Scan-to-Trace QR System Verification Report

**Status:** `TESTED` (Automated API + Frontend tests passing; physical camera scan & label print walkthrough pending `MANUAL_UI_VERIFIED`)

## 1. QR Reference & Security Model
- **Model:** `BatchQrReference` (`apps/api/prisma/schema.prisma`, migration `20261126131119_add_batch_qr_references`).
- **Opaque Token:** Generated via `crypto.randomBytes(18).toString('base64url')` — never exposes sequential IDs, customer data, or credentials. Reuses existing active QR per batch (`generateOrGetQr`) and supports revocation + regeneration (`revokeAndRegenerateQr`, returning HTTP `410 Gone` for revoked tokens).
- **Access Control:** Protected by `authenticate`, `requirePermissions('production.batches.read')`, and `assertWarehouseAccess(user, batch.warehouseId, 'READ')`. Costing is shown only with `production.costing.read`; dispatch references only with `sales.orders.read`.

## 2. Label Printing, Scanning & Genealogy
- **Label Modal:** `BatchQrLabelModal.tsx` renders an ISO/IEC 18004 scannable QR code (`qrcode` package) with print-friendly CSS (`print:*`) showing product, variant, batch #, mfg/expiry dates, quantity, and plant.
- **Scanning:** `BatchTraceabilityPage.tsx` integrates `ScannerInput.tsx` (camera `BarcodeDetector` + manual token/URL fallback).
- **Traceability View:** `/trace/batch/:reference` (`QrTraceabilityPage.tsx`) displays batch identity, BOM & input raw material batches, quality inspection history, finished goods & dispatch movements, and a chronological timeline.

## 3. Test Results
- `apps/api/test/batch-qr.test.ts`: **2/2 passed** (401/403 RBAC, opaque token generation, duplicate prevention, traceability resolution, revocation returning 410).
- `apps/web/src/test/qr-traceability.test.tsx`: **2/2 passed** (traceability rendering & revoked QR error state).
