-- CreateEnum
CREATE TYPE "ShiftHandoverStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'RETURNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShiftHandoverPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SubstitutionCompatibility" AS ENUM ('COMPATIBLE', 'COMPATIBLE_WITH_WARNING', 'REQUIRES_REVIEW', 'NOT_COMPATIBLE');

-- CreateEnum
CREATE TYPE "SubstitutionRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "shift_handovers" (
    "id" TEXT NOT NULL,
    "handover_number" VARCHAR(40) NOT NULL,
    "factory_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "production_line" VARCHAR(80),
    "shift_name" VARCHAR(40) NOT NULL,
    "shift_date" DATE NOT NULL,
    "outgoing_user_id" TEXT NOT NULL,
    "incoming_user_id" TEXT,
    "status" "ShiftHandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "ShiftHandoverPriority" NOT NULL DEFAULT 'NORMAL',
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "active_batches_summary" JSONB,
    "pending_work_orders_summary" JSONB,
    "material_shortages_summary" JSONB,
    "equipment_issues" TEXT,
    "pending_quality_notes" TEXT,
    "production_delays" TEXT,
    "safety_observations" TEXT,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "acknowledged_by_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgement_notes" TEXT,
    "returned_by_id" TEXT,
    "returned_at" TIMESTAMP(3),
    "return_reason" TEXT,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_handover_histories" (
    "id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "from_status" "ShiftHandoverStatus",
    "to_status" "ShiftHandoverStatus" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "remarks" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_handover_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_substitution_requests" (
    "id" TEXT NOT NULL,
    "request_number" VARCHAR(40) NOT NULL,
    "factory_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "production_batch_id" TEXT,
    "work_order_id" TEXT,
    "original_item_id" TEXT NOT NULL,
    "substitute_item_id" TEXT NOT NULL,
    "required_quantity" DECIMAL(14,4) NOT NULL,
    "uom_id" TEXT NOT NULL,
    "compatibility_status" "SubstitutionCompatibility" NOT NULL,
    "evaluation_reasons" JSONB NOT NULL,
    "allergen_comparison" JSONB NOT NULL,
    "status" "SubstitutionRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reason" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_notes" TEXT,
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "applied_by_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "application_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_substitution_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_handovers_handover_number_key" ON "shift_handovers"("handover_number");

-- CreateIndex
CREATE INDEX "shift_handovers_factory_id_shift_date_status_idx" ON "shift_handovers"("factory_id", "shift_date", "status");

-- CreateIndex
CREATE INDEX "shift_handovers_status_priority_idx" ON "shift_handovers"("status", "priority");

-- CreateIndex
CREATE INDEX "shift_handover_histories_handover_id_created_at_idx" ON "shift_handover_histories"("handover_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_substitution_requests_request_number_key" ON "material_substitution_requests"("request_number");

-- CreateIndex
CREATE INDEX "material_substitution_requests_warehouse_id_status_idx" ON "material_substitution_requests"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "material_substitution_requests_production_batch_id_idx" ON "material_substitution_requests"("production_batch_id");

-- AddForeignKey
ALTER TABLE "shift_handover_histories" ADD CONSTRAINT "shift_handover_histories_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "shift_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
