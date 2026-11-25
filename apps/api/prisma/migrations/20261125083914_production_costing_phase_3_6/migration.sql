-- CreateEnum
CREATE TYPE "ProductionCostingStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ProductionCostEntryType" AS ENUM ('DIRECT_LABOUR', 'MACHINE_COST', 'OTHER_DIRECT_EXPENSE');

-- CreateEnum
CREATE TYPE "CostEntryApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OverheadAllocationMethod" AS ENUM ('PER_BATCH', 'PER_UNIT', 'PERCENT_OF_MATERIAL', 'PER_LABOUR_HOUR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'COST_ENTRY';
ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'COSTING_CALCULATION';
ALTER TYPE "ProductionExecutionEntryType" ADD VALUE 'COSTING_FINALIZATION';

-- CreateTable
CREATE TABLE "production_batch_costings" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "status" "ProductionCostingStatus" NOT NULL DEFAULT 'DRAFT',
    "planned_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "actual_good_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "wastage_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "standard_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "standard_labour_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "standard_overhead_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "standard_total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "gross_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "material_return_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "net_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "raw_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "packaging_material_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "actual_labour_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "actual_machine_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "other_direct_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "actual_overhead_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "wastage_and_rejection_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_actual_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "good_output_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost_per_accepted_unit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "material_variance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "material_variance_percent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "labour_variance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "labour_variance_percent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overhead_variance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "overhead_variance_percent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_variance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_variance_percent" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "fg_valuation_applied" BOOLEAN NOT NULL DEFAULT false,
    "fg_valuation_unit_cost" DECIMAL(18,4),
    "fg_valuation_adjustment_tx_id" TEXT,
    "fg_valuation_applied_at" TIMESTAMP(3),
    "post_finalization_adjustment_note" TEXT,
    "calculated_at" TIMESTAMP(3),
    "calculated_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "review_notes" TEXT,
    "finalized_at" TIMESTAMP(3),
    "finalized_by_id" TEXT,
    "finalization_idempotency_key" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batch_costings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_cost_entries" (
    "id" TEXT NOT NULL,
    "production_batch_costing_id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "entry_type" "ProductionCostEntryType" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "quantity_or_hours" DECIMAL(14,4) NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "reference" VARCHAR(100),
    "approval_status" "CostEntryApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "notes" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_overhead_allocations" (
    "id" TEXT NOT NULL,
    "production_batch_costing_id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "bom_overhead_id" TEXT,
    "cost_type" "OverheadCostType" NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "allocation_method" "OverheadAllocationMethod" NOT NULL,
    "basis_value" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "rate_or_amount" DECIMAL(18,4) NOT NULL,
    "allocated_amount" DECIMAL(18,4) NOT NULL,
    "is_from_bom" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_overhead_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_costing_history" (
    "id" TEXT NOT NULL,
    "production_batch_costing_id" TEXT NOT NULL,
    "from_status" "ProductionCostingStatus",
    "to_status" "ProductionCostingStatus" NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_costing_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_costings_production_batch_id_key" ON "production_batch_costings"("production_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_costings_finalization_idempotency_key_key" ON "production_batch_costings"("finalization_idempotency_key");

-- CreateIndex
CREATE INDEX "production_batch_costings_status_idx" ON "production_batch_costings"("status");

-- CreateIndex
CREATE INDEX "production_batch_costings_finalized_at_idx" ON "production_batch_costings"("finalized_at");

-- CreateIndex
CREATE INDEX "production_cost_entries_production_batch_costing_id_idx" ON "production_cost_entries"("production_batch_costing_id");

-- CreateIndex
CREATE INDEX "production_cost_entries_production_batch_id_idx" ON "production_cost_entries"("production_batch_id");

-- CreateIndex
CREATE INDEX "production_cost_entries_entry_type_idx" ON "production_cost_entries"("entry_type");

-- CreateIndex
CREATE INDEX "production_cost_entries_approval_status_idx" ON "production_cost_entries"("approval_status");

-- CreateIndex
CREATE INDEX "production_overhead_allocations_production_batch_costing_id_idx" ON "production_overhead_allocations"("production_batch_costing_id");

-- CreateIndex
CREATE INDEX "production_overhead_allocations_production_batch_id_idx" ON "production_overhead_allocations"("production_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_overhead_allocations_production_batch_id_bom_ove_key" ON "production_overhead_allocations"("production_batch_id", "bom_overhead_id");

-- CreateIndex
CREATE INDEX "production_costing_history_production_batch_costing_id_idx" ON "production_costing_history"("production_batch_costing_id");

-- AddForeignKey
ALTER TABLE "production_batch_costings" ADD CONSTRAINT "production_batch_costings_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_costings" ADD CONSTRAINT "production_batch_costings_calculated_by_id_fkey" FOREIGN KEY ("calculated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_costings" ADD CONSTRAINT "production_batch_costings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_costings" ADD CONSTRAINT "production_batch_costings_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_production_batch_costing_id_fkey" FOREIGN KEY ("production_batch_costing_id") REFERENCES "production_batch_costings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cost_entries" ADD CONSTRAINT "production_cost_entries_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_overhead_allocations" ADD CONSTRAINT "production_overhead_allocations_production_batch_costing_i_fkey" FOREIGN KEY ("production_batch_costing_id") REFERENCES "production_batch_costings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_overhead_allocations" ADD CONSTRAINT "production_overhead_allocations_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_overhead_allocations" ADD CONSTRAINT "production_overhead_allocations_bom_overhead_id_fkey" FOREIGN KEY ("bom_overhead_id") REFERENCES "bom_overheads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_overhead_allocations" ADD CONSTRAINT "production_overhead_allocations_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_costing_history" ADD CONSTRAINT "production_costing_history_production_batch_costing_id_fkey" FOREIGN KEY ("production_batch_costing_id") REFERENCES "production_batch_costings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_costing_history" ADD CONSTRAINT "production_costing_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
