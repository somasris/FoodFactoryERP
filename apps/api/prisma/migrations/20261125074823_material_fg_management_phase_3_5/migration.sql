-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PENDING_INSPECTION', 'ACCEPTED', 'QUARANTINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InspectionDecision" AS ENUM ('PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'QUARANTINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VarianceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'MATERIAL_RETURN';
ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'VARIANCE_APPROVAL';
ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'QUALITY_INSPECTION';

-- AlterTable
ALTER TABLE "inventory_batches" ADD COLUMN     "quality_status" "QualityStatus" NOT NULL DEFAULT 'ACCEPTED';

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "shelf_life_days" INTEGER;

-- CreateTable
CREATE TABLE "production_batch_returns" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "returned_quantity" DECIMAL(14,4) NOT NULL,
    "base_quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inventory_receipt_id" TEXT,
    "inventory_transaction_id" TEXT,
    "idempotency_key" VARCHAR(100),
    "reason" TEXT NOT NULL,
    "returned_by_id" TEXT NOT NULL,
    "returned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_batch_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batch_variance_approvals" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "expected_quantity" DECIMAL(14,4) NOT NULL,
    "actual_quantity" DECIMAL(14,4) NOT NULL,
    "variance_quantity" DECIMAL(14,4) NOT NULL,
    "variance_percent" DECIMAL(7,2) NOT NULL,
    "threshold_percent" DECIMAL(7,2) NOT NULL,
    "status" "VarianceApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batch_variance_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections" (
    "id" TEXT NOT NULL,
    "inspection_number" VARCHAR(40) NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "inventory_batch_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "inspected_quantity" DECIMAL(14,4) NOT NULL,
    "good_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "decision" "InspectionDecision" NOT NULL DEFAULT 'PENDING',
    "defect_category" VARCHAR(80),
    "notes" TEXT,
    "evidence_ref" VARCHAR(255),
    "inspector_id" TEXT,
    "inspected_at" TIMESTAMP(3),
    "released_by_id" TEXT,
    "released_at" TIMESTAMP(3),
    "release_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_returns_idempotency_key_key" ON "production_batch_returns"("idempotency_key");

-- CreateIndex
CREATE INDEX "production_batch_returns_production_batch_id_idx" ON "production_batch_returns"("production_batch_id");

-- CreateIndex
CREATE INDEX "production_batch_returns_inventory_item_id_idx" ON "production_batch_returns"("inventory_item_id");

-- CreateIndex
CREATE INDEX "production_batch_variance_approvals_production_batch_id_idx" ON "production_batch_variance_approvals"("production_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_variance_approvals_production_batch_id_inv_key" ON "production_batch_variance_approvals"("production_batch_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_inspection_number_key" ON "quality_inspections"("inspection_number");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_production_batch_id_key" ON "quality_inspections"("production_batch_id");

-- CreateIndex
CREATE INDEX "quality_inspections_decision_idx" ON "quality_inspections"("decision");

-- CreateIndex
CREATE INDEX "quality_inspections_inventory_batch_id_idx" ON "quality_inspections"("inventory_batch_id");

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_returns" ADD CONSTRAINT "production_batch_returns_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_variance_approvals" ADD CONSTRAINT "production_batch_variance_approvals_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_variance_approvals" ADD CONSTRAINT "production_batch_variance_approvals_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_variance_approvals" ADD CONSTRAINT "production_batch_variance_approvals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inventory_batch_id_fkey" FOREIGN KEY ("inventory_batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
