# FoodFactoryERP – P0 Mandatory Accounting & GST Remediation Verification Report

**Date:** 2026-11-27  
**Project Root:** `D:\somasri\projects\FoodFactoryERP`  
**Branch:** `main`  
**Commits:**
- `4013545` — `feat(db): add P0 accounting and GST schema migration and RBAC permissions`
- `99b1480` — `feat(sales): implement customer payments, ageing, and GST credit notes API`
- `77f75af` — `feat(purchases): implement supplier purchase invoices, receipt matching, and GST register`
- `ed14f98` — `feat(web): add customer payments, receivables ageing, credit notes, and purchase register UI`
- `cc2d25b` — `test(compliance): verify P0 financial workflows, RBAC, and exact benchmark`

---

## A. Executive Summary

All three P0 accounting and GST compliance gaps identified in `FOODFACTORYERP_PROBLEM_STATEMENT_COMPLIANCE_AUDIT.md` have been **IMPLEMENTED** and **AUTOMATED_TESTED**:

1. **P0.1 Customer Payments, Receivables & Ageing:** `IMPLEMENTED` & `AUTOMATED_TESTED`
2. **P0.2 GST Credit Notes & Issued-Invoice Cancellation:** `IMPLEMENTED` & `AUTOMATED_TESTED`
3. **P0.3 Supplier Purchase Invoices, Receipt Matching & Purchase Register:** `IMPLEMENTED` & `AUTOMATED_TESTED`
4. **P0.4 Exact Section 7 Official Benchmark (Murukku 200 g):** `IMPLEMENTED` & `AUTOMATED_TESTED`
5. **Manual Live Browser UI Verification (`MANUAL_UI_VERIFIED`):** `BLOCKED` (live browser session not run; UI verified via Vitest/RTL suites and Vite production build).

---

## B. P0.1 – Customer Payments, Receivables & Ageing

- **Database Models (`apps/api/prisma/schema.prisma`):**
  - `CustomerPayment` (`paymentNumber` `PAY/FY/00001`, `customerId`, `paymentDate`, `amount`, `paymentMode`, `transactionReference`, `status` `RECORDED | REVERSED`, `idempotencyKey`, `reversedById`, `reversedAt`, `reversalReason`)
  - `PaymentAllocation` (`paymentId`, `salesInvoiceId`, `allocatedAmount`, `isReversed`, `reversedAt`, `createdById`)
  - `SalesInvoice.paymentStatus` (`UNPAID | PARTIALLY_PAID | PAID`), kept separate from `SalesInvoice.status` (`DRAFT | ISSUED | CANCELLED`).
- **Migration:** `apps/api/prisma/migrations/20261127044205_p0_accounting_gst_remediation/migration.sql`
- **API Endpoints (`/api/v1/sales`):**
  - `GET /payments`, `POST /payments`, `GET /payments/:id`, `POST /payments/:id/allocate`, `POST /payments/:id/reverse`
  - `GET /invoices/:id/payments`, `GET /customers/:customerId/payments`, `GET /customers/:customerId/outstanding`
  - `GET /receivables`, `GET /ageing` (supports `?format=csv|excel|pdf` via `ComplianceExportService`)
- **Frontend Pages:**
  - `apps/web/src/routes/sales/CustomerPaymentsPage.tsx`
  - `apps/web/src/routes/sales/ReceivablesAgeingPage.tsx`
  - `apps/web/src/routes/sales/SalesInvoiceDetailPage.tsx` (displays Payment Status, Paid, Credit Notes, Outstanding)
- **Allocation & Financial Rules (`customer-payment.service.ts`):**
  - Transactional `SELECT ... FOR UPDATE` locking on `customer_payments` and sorted `sales_invoices` IDs.
  - `Invoice Outstanding = max(0, Issued Grand Total - Net Allocated Payments - Issued Credit Notes)`.
  - Excess customer payments / credit notes are surfaced explicitly as `excessCreditBalance` and `unallocatedPayments`.
  - Ageing buckets: `Not Due`, `1–30 Days`, `31–60 Days`, `61–90 Days`, `Above 90 Days`, using `SalesInvoice.dueDate` with documented fallback to `SalesInvoice.invoiceDate`.
- **Test Evidence:** `apps/api/test/p0-accounting-gst.test.ts` (Tests 1 & 2).

---

## C. P0.2 – GST Credit Notes & Issued-Invoice Cancellation

- **Database Models:** `CreditNote` (`creditNoteNumber` `CN/FY/00001`, preserved party & GST snapshots from parent `SalesInvoice`, `status` `DRAFT | ISSUED | CANCELLED`), `CreditNoteLine`, `CreditNoteStatusHistory`.
- **Lifecycle & Invoice Cancellation Rule:**
  - `DRAFT → ISSUED → CANCELLED`.
  - `SalesInvoiceService.cancelInvoice` blocks direct cancellation of `ISSUED` invoices (`400`: *"Issued sales invoices cannot be directly cancelled. Please issue a GST Credit Note instead."*), while retaining `DRAFT` invoice cancellation.
  - Original invoice number, GST snapshots, and PDF are preserved untouched.
- **Financial & Physical Separation:**
  - Credit notes reduce invoice outstanding and update `SalesInvoice.paymentStatus`; excess credit over paid/invoiced total is tracked in `getCustomerCreditBalance()` without deleting historical payment allocations.
  - Financial credit notes **never** increase physical inventory (`InventoryBalance` is untouched).
  - `GstComplianceService.getGstSalesSummary()` includes `creditNoteTotals` and `netSalesTotals`.
- **API Endpoints (`/api/v1/sales`):**
  - `GET /credit-notes`, `POST /credit-notes`, `GET /credit-notes/:id`, `GET /credit-notes/:id/pdf` (via `CreditNotePdfService`), `POST /credit-notes/:id/issue`, `POST /credit-notes/:id/cancel`, `GET /invoices/:id/credit-notes`, `GET /customers/:customerId/credit-balance`.
- **Frontend:** `apps/web/src/routes/sales/CreditNotesPage.tsx` and `SalesInvoiceDetailPage.tsx`.
- **Test Evidence:** `apps/api/test/p0-accounting-gst.test.ts` (Test 3) and `apps/api/test/sales-invoices.test.ts`.

---

## D. P0.3 – Supplier Purchase Invoices & Purchase Register

- **Database Models:** `SupplierInvoice` (`supplierInvoiceNumber` unique per `supplierId`, `internalInvoiceNumber` `PINV/FY/00001`, `status` `DRAFT | POSTED | CANCELLED`, `matchingStatus` `UNMATCHED | PARTIALLY_MATCHED | MATCHED | MISMATCH`, `itcStatus` `PENDING_VERIFICATION | ELIGIBLE | INELIGIBLE`), `SupplierInvoiceLine`, `SupplierInvoiceReceiptMatch`, `SupplierInvoiceStatusHistory`.
- **Physical Receipt Separation:**
  - Creating/posting a `SupplierInvoice` never modifies `InventoryBalance` or `InventoryReceipt` historical costs.
  - Matching checks item presence, quantity, UOM, and unit rate against `POSTED` `InventoryReceipt`s and records discrepancies without mutating stock.
- **Purchase Register & GST Reporting:**
  - `GET /api/v1/purchases/register` (supports filters + `?format=csv|excel|pdf`).
  - `GstComplianceService.getPurchaseTaxSummary()` now queries `POSTED` `SupplierInvoice` records, returns `purchaseInvoicingSupported: true`, and separates `purchaseGstRecorded`, `itcEligible`, `itcPendingVerification`, and `itcIneligible`.
- **Frontend:** `apps/web/src/components/purchases/PurchasesLayout.tsx`, `apps/web/src/routes/purchases/SupplierInvoicesPage.tsx`, `apps/web/src/routes/purchases/PurchaseRegisterPage.tsx`.
- **Test Evidence:** `apps/api/test/p0-accounting-gst.test.ts` (Tests 1 & 4) and `apps/api/test/compliance-phase4-2.test.ts`.

---

## E. Exact Section 7 Official Benchmark Results ("Murukku 200 g")

Executed end-to-end through real API endpoints and PostgreSQL in `apps/api/test/p0-accounting-gst.test.ts` (Test 1) with exact official inputs (previous audit used `100+50-30`, `20+10-10.5`, `40-19`; this run uses the exact official inputs):

| Metric | Official Expected | Observed Actual | Calculation / Evidence | Status |
|---|---:|---:|---|---|
| **Flour Closing** | `120 kg` | `120 kg` | `100 + 60 - 40 = 120` | **PASS** |
| **Cooking Oil Closing** | `19.5 L` | `19.5 L` | `30 - 10.5 = 19.5` | **PASS** |
| **Spice Mix Closing** | `3.8 kg` | `3.8 kg` | `5 - 1.2 = 3.8` | **PASS** |
| **200 g Pouches Closing** | `306 pcs` | `306 pcs` | `500 - 188 - 6 = 306` | **PASS** |
| **Cartons Closing** | `21 pcs` | `21 pcs` | `30 - 9 = 21` | **PASS** |
| **FG After Production** | `238 packets` | `238 packets` | `50 + 188 = 238` | **PASS** |
| **FG After Retailer A Dispatch** | `88 packets` | `88 packets` | `238 - 150 = 88` | **PASS** |
| **Batch Total Cost (MWAC)** | `₹5,855` | `₹5,855` | Material/Pkg `4055` (`Flour 40 × 43.125 MWAC = 1725`, `Oil 1470`, `Spice 240`, `Pouches 485`, `Cartons 135`) + Labour `1200` + Gas/Power `600` = `5855` (`₹31.1436/pkt`) | **PASS** |
| **Retailer A GST Invoice** | `₹7,875` | `₹7,875` | `7500` taxable + `187.50` CGST + `187.50` SGST + `0` IGST | **PASS** |
| **Distributor B Order (120 pkts)** | Blocked (`Short by 32`) | `400` (`Short by 32`) | `120 requested - 88 available = 32` | **PASS** |
| **Retailer A Outstanding after ₹4,000** | `₹3,875.00` | `3875.00` | `7875 - 4000 = 3875.00` via `CustomerPayment` + `PaymentAllocation` | **PASS** |
| **Flour Supplier Invoice in Register** | Taxable `₹2,700`, GST `₹135` | `2700.00` / `135.00` | `60 × ₹45`, 5% GST, `MATCHED` to Flour receipt | **PASS** |

---

## F. RBAC Matrix Verification

Verified in `apps/api/test/p0-accounting-gst.test.ts` and `apps/api/src/middleware/auth.middleware.ts` (`READ_ONLY_PERMISSIONS` updated for `AUDITOR`):

| Role | Payments | Credit Notes | Supplier Invoices & Purchase Register |
|---|---|---|---|
| **OWNER** | Full access (incl. Reverse) | Full access | Full access |
| **ADMIN** | Full access | Full access | Full access |
| **SALESMAN** | `read`, `create`, `allocate` | `read`, `download` | Denied (`403`) |
| **PRODUCTION** | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| **AUDITOR** | Read-only (`403` on mutations) | Read-only + PDF | Read-only (`403` on mutations) |

---

## G. Quality Gates

Executed from project root after final code edits:
- `pnpm typecheck`: **EXIT `0`** (`@foodfactory/api` + `@foodfactory/web`)
- `pnpm lint`: **EXIT `0`** (`0` errors; `9` warnings in `@foodfactory/api`, `5` warnings in `@foodfactory/web`)
- `pnpm test`: **EXIT `0`** — **75 test files, 321 tests passed** (`@foodfactory/api`: `35` files, `179` tests passed; `@foodfactory/web`: `40` files, `142` tests passed)
- `pnpm build`: **EXIT `0`** (`@foodfactory/api` `tsc` + `@foodfactory/web` `vite build` + PWA SW)

---

## H. Remaining Status & Limitations

- `Customer Payments, Receivables & Ageing`: `IMPLEMENTED`, `AUTOMATED_TESTED`, `MANUAL_UI_VERIFIED: BLOCKED`
- `GST Credit Notes & Invoice Cancellation`: `IMPLEMENTED`, `AUTOMATED_TESTED`, `MANUAL_UI_VERIFIED: BLOCKED`
- `Supplier Purchase Invoices & Purchase Register`: `IMPLEMENTED`, `AUTOMATED_TESTED`, `MANUAL_UI_VERIFIED: BLOCKED`
- **Out-of-Scope Items (unchanged per strict P0 scope):** Benchmark seed script in `seed.ts`, 2-page Design Note, Demo Video, Hosted Live URL, Tally XML, e-Invoice/e-Way Bill JSON, Salesman GPS/route tracking.
