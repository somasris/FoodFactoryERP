-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NEFT_RTGS', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptMatchStatus" AS ENUM ('UNMATCHED', 'PARTIALLY_MATCHED', 'MATCHED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "ItcStatus" AS ENUM ('PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE');

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "payment_status" "InvoicePaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "customer_payments" (
    "id" TEXT NOT NULL,
    "payment_number" VARCHAR(40) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "customer_id" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "transaction_reference" VARCHAR(100),
    "notes" TEXT,
    "status" "CustomerPaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "reversed_by_id" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "credit_note_number" VARCHAR(40) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "credit_note_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "company_legal_name" VARCHAR(150) NOT NULL,
    "company_gstin" VARCHAR(15) NOT NULL,
    "company_state_code" VARCHAR(2) NOT NULL,
    "company_address" TEXT NOT NULL,
    "customer_legal_name" VARCHAR(150) NOT NULL,
    "customer_gstin" VARCHAR(15),
    "customer_state_code" VARCHAR(2) NOT NULL,
    "customer_billing_address" TEXT NOT NULL,
    "place_of_supply" VARCHAR(100) NOT NULL,
    "is_inter_state" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "issued_by_id" TEXT,
    "issued_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "original_invoice_line_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "item_code_snapshot" VARCHAR(40) NOT NULL,
    "description_snapshot" VARCHAR(200) NOT NULL,
    "hsn_code_snapshot" VARCHAR(10) NOT NULL,
    "uom_symbol_snapshot" VARCHAR(10) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(14,2) NOT NULL,
    "tax_rate_snapshot" DECIMAL(5,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_status_history" (
    "id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "from_status" "CreditNoteStatus",
    "to_status" "CreditNoteStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "supplier_invoice_number" VARCHAR(60) NOT NULL,
    "internal_invoice_number" VARCHAR(40) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "received_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "supplier_legal_name" VARCHAR(150) NOT NULL,
    "supplier_gstin" VARCHAR(15),
    "supplier_state_code" VARCHAR(2) NOT NULL,
    "place_of_supply" VARCHAR(100) NOT NULL,
    "is_inter_state" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "matching_status" "ReceiptMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "itc_status" "ItcStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "itc_notes" TEXT,
    "notes" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "posted_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_lines" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "description_snapshot" VARCHAR(200) NOT NULL,
    "hsn_code_snapshot" VARCHAR(10) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(14,2) NOT NULL,
    "tax_rate_snapshot" DECIMAL(5,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_receipt_matches" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "match_status" "ReceiptMatchStatus" NOT NULL,
    "discrepancies" JSONB,
    "matched_by_id" TEXT NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "supplier_invoice_receipt_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_status_history" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "from_status" "SupplierInvoiceStatus",
    "to_status" "SupplierInvoiceStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_payments_payment_number_key" ON "customer_payments"("payment_number");

-- CreateIndex
CREATE UNIQUE INDEX "customer_payments_idempotency_key_key" ON "customer_payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "customer_payments_customer_id_idx" ON "customer_payments"("customer_id");

-- CreateIndex
CREATE INDEX "customer_payments_status_idx" ON "customer_payments"("status");

-- CreateIndex
CREATE INDEX "customer_payments_payment_date_idx" ON "customer_payments"("payment_date");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_sales_invoice_id_idx" ON "payment_allocations"("sales_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_credit_note_number_key" ON "credit_notes"("credit_note_number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_idempotency_key_key" ON "credit_notes"("idempotency_key");

-- CreateIndex
CREATE INDEX "credit_notes_sales_invoice_id_idx" ON "credit_notes"("sales_invoice_id");

-- CreateIndex
CREATE INDEX "credit_notes_customer_id_idx" ON "credit_notes"("customer_id");

-- CreateIndex
CREATE INDEX "credit_notes_status_idx" ON "credit_notes"("status");

-- CreateIndex
CREATE INDEX "credit_notes_credit_note_date_idx" ON "credit_notes"("credit_note_date");

-- CreateIndex
CREATE INDEX "credit_note_lines_original_invoice_line_id_idx" ON "credit_note_lines"("original_invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_lines_credit_note_id_line_number_key" ON "credit_note_lines"("credit_note_id", "line_number");

-- CreateIndex
CREATE INDEX "credit_note_status_history_credit_note_id_idx" ON "credit_note_status_history"("credit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_internal_invoice_number_key" ON "supplier_invoices"("internal_invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_idempotency_key_key" ON "supplier_invoices"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_factory_id_idx" ON "supplier_invoices"("factory_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_status_idx" ON "supplier_invoices"("status");

-- CreateIndex
CREATE INDEX "supplier_invoices_matching_status_idx" ON "supplier_invoices"("matching_status");

-- CreateIndex
CREATE INDEX "supplier_invoices_itc_status_idx" ON "supplier_invoices"("itc_status");

-- CreateIndex
CREATE INDEX "supplier_invoices_invoice_date_idx" ON "supplier_invoices"("invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_supplier_id_supplier_invoice_number_key" ON "supplier_invoices"("supplier_id", "supplier_invoice_number");

-- CreateIndex
CREATE INDEX "supplier_invoice_lines_inventory_item_id_idx" ON "supplier_invoice_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoice_lines_supplier_invoice_id_line_number_key" ON "supplier_invoice_lines"("supplier_invoice_id", "line_number");

-- CreateIndex
CREATE INDEX "supplier_invoice_receipt_matches_receipt_id_idx" ON "supplier_invoice_receipt_matches"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoice_receipt_matches_supplier_invoice_id_receip_key" ON "supplier_invoice_receipt_matches"("supplier_invoice_id", "receipt_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_status_history_supplier_invoice_id_idx" ON "supplier_invoice_status_history"("supplier_invoice_id");

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "customer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_original_invoice_line_id_fkey" FOREIGN KEY ("original_invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_status_history" ADD CONSTRAINT "credit_note_status_history_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_receipt_matches" ADD CONSTRAINT "supplier_invoice_receipt_matches_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_receipt_matches" ADD CONSTRAINT "supplier_invoice_receipt_matches_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inventory_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_status_history" ADD CONSTRAINT "supplier_invoice_status_history_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
