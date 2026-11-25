-- CreateEnum
CREATE TYPE "InventoryDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferDocumentStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PickingStrategy" AS ENUM ('FIFO', 'FEFO');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('PHYSICAL_COUNT', 'DAMAGE', 'SPOILAGE', 'EXPIRY', 'SHRINKAGE', 'OPENING_STOCK', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DISPATCH';
ALTER TYPE "AuditAction" ADD VALUE 'RECEIVE';
ALTER TYPE "AuditAction" ADD VALUE 'REVERSE';

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_number" VARCHAR(60) NOT NULL,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "received_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "supplier_batch_ref" VARCHAR(60),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "quantity_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantity_reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "last_transaction_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "transaction_number" VARCHAR(40) NOT NULL,
    "transaction_type" "InventoryTransactionType" NOT NULL,
    "reference_type" VARCHAR(40) NOT NULL,
    "reference_id" VARCHAR(36) NOT NULL,
    "reference_number" VARCHAR(40) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "reversed_transaction_id" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by_id" TEXT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transaction_lines" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_uom_id" TEXT NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "mwac_after" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" VARCHAR(40) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "InventoryDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_ref" VARCHAR(100),
    "notes" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_receipt_lines" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "batch_number" VARCHAR(60),
    "batch_id" TEXT,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "notes" TEXT,

    CONSTRAINT "inventory_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_issues" (
    "id" TEXT NOT NULL,
    "issue_number" VARCHAR(40) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "InventoryDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "picking_strategy" "PickingStrategy" NOT NULL DEFAULT 'FEFO',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_ref" VARCHAR(100),
    "purpose" VARCHAR(150),
    "notes" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_issue_lines" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "requested_quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "batch_id" TEXT,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "inventory_issue_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "transfer_number" VARCHAR(40) NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT NOT NULL,
    "status" "TransferDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "transfer_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "dispatch_idempotency_key" VARCHAR(100),
    "receive_idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "dispatched_by_id" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "received_by_id" TEXT,
    "received_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_lines" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "base_quantity" DECIMAL(18,4) NOT NULL,
    "dispatched_base_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "received_base_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "inventory_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "adjustment_number" VARCHAR(40) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "InventoryDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "adjustment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "AdjustmentReason" NOT NULL,
    "notes" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "posted_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustment_lines" (
    "id" TEXT NOT NULL,
    "adjustment_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "quantity_delta" DECIMAL(18,4) NOT NULL,
    "base_quantity_delta" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reason_note" TEXT,

    CONSTRAINT "inventory_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_batches_inventory_item_id_idx" ON "inventory_batches"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_batches_expiry_date_idx" ON "inventory_batches"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_batches_inventory_item_id_batch_number_key" ON "inventory_batches"("inventory_item_id", "batch_number");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_id_idx" ON "inventory_balances"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_balances_inventory_item_id_idx" ON "inventory_balances"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_balances_batch_id_idx" ON "inventory_balances"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouse_id_inventory_item_id_batch_id_key" ON "inventory_balances"("warehouse_id", "inventory_item_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_transaction_number_key" ON "inventory_transactions"("transaction_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_idempotency_key_key" ON "inventory_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_reversed_transaction_id_key" ON "inventory_transactions"("reversed_transaction_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_reference_type_reference_id_idx" ON "inventory_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_warehouse_id_idx" ON "inventory_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_transaction_date_idx" ON "inventory_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_inventory_item_id_idx" ON "inventory_transaction_lines"("inventory_item_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_batch_id_idx" ON "inventory_transaction_lines"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transaction_lines_transaction_id_line_number_key" ON "inventory_transaction_lines"("transaction_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_receipts_receipt_number_key" ON "inventory_receipts"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_receipts_idempotency_key_key" ON "inventory_receipts"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_receipts_warehouse_id_idx" ON "inventory_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_receipts_status_idx" ON "inventory_receipts"("status");

-- CreateIndex
CREATE INDEX "inventory_receipt_lines_inventory_item_id_idx" ON "inventory_receipt_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_receipt_lines_receipt_id_line_number_key" ON "inventory_receipt_lines"("receipt_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_issues_issue_number_key" ON "inventory_issues"("issue_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_issues_idempotency_key_key" ON "inventory_issues"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_issues_warehouse_id_idx" ON "inventory_issues"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_issues_status_idx" ON "inventory_issues"("status");

-- CreateIndex
CREATE INDEX "inventory_issue_lines_inventory_item_id_idx" ON "inventory_issue_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_issue_lines_issue_id_line_number_key" ON "inventory_issue_lines"("issue_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_transfer_number_key" ON "inventory_transfers"("transfer_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_dispatch_idempotency_key_key" ON "inventory_transfers"("dispatch_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfers_receive_idempotency_key_key" ON "inventory_transfers"("receive_idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_transfers_source_warehouse_id_idx" ON "inventory_transfers"("source_warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_destination_warehouse_id_idx" ON "inventory_transfers"("destination_warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers"("status");

-- CreateIndex
CREATE INDEX "inventory_transfer_lines_inventory_item_id_idx" ON "inventory_transfer_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transfer_lines_transfer_id_line_number_key" ON "inventory_transfer_lines"("transfer_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_adjustment_number_key" ON "inventory_adjustments"("adjustment_number");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_idempotency_key_key" ON "inventory_adjustments"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_adjustments_warehouse_id_idx" ON "inventory_adjustments"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_status_idx" ON "inventory_adjustments"("status");

-- CreateIndex
CREATE INDEX "inventory_adjustment_lines_inventory_item_id_idx" ON "inventory_adjustment_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustment_lines_adjustment_id_line_number_key" ON "inventory_adjustment_lines"("adjustment_id", "line_number");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_reversed_transaction_id_fkey" FOREIGN KEY ("reversed_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipts" ADD CONSTRAINT "inventory_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_lines" ADD CONSTRAINT "inventory_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inventory_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_lines" ADD CONSTRAINT "inventory_receipt_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_lines" ADD CONSTRAINT "inventory_receipt_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_receipt_lines" ADD CONSTRAINT "inventory_receipt_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issues" ADD CONSTRAINT "inventory_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "inventory_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_issue_lines" ADD CONSTRAINT "inventory_issue_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 1.5 Stage 3 Database-Level Invariants
-- Enforce non-negative physical and reserved quantities at the PostgreSQL level
ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_inventory_balances_qty_on_hand_nonneg" CHECK ("quantity_on_hand" >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_inventory_balances_qty_reserved_nonneg" CHECK ("quantity_reserved" >= 0);

-- Enforce uniqueness for non-batched balances (where batch_id IS NULL)
CREATE UNIQUE INDEX "uq_inventory_balances_wh_item_null_batch" ON "inventory_balances" ("warehouse_id", "inventory_item_id") WHERE "batch_id" IS NULL;
