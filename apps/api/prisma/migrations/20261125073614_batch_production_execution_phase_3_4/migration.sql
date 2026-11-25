-- CreateEnum
CREATE TYPE "ProductionBatchStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionExecutionEntryType" AS ENUM ('STATUS_CHANGE', 'MATERIAL_CONSUMPTION', 'OUTPUT_UPDATE', 'MATERIAL_RESERVATION', 'NOTE');

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "allocated_batch_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "production_batch_number_sequences" (
    "id" TEXT NOT NULL,
    "prefix" VARCHAR(15) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batch_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "batch_number" VARCHAR(40) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "planned_quantity" DECIMAL(14,4) NOT NULL,
    "actual_good_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "rejected_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "wastage_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "actual_yield_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "completion_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "wastage_reason" TEXT,
    "notes" TEXT,
    "status" "ProductionBatchStatus" NOT NULL DEFAULT 'CREATED',
    "operator_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "manufacturing_date" DATE,
    "expiry_date" DATE,
    "materials_reserved" BOOLEAN NOT NULL DEFAULT false,
    "finished_goods_batch_id" TEXT,
    "finished_goods_receipt_id" TEXT,
    "finished_goods_transaction_id" TEXT,
    "idempotency_key" VARCHAR(100),
    "completion_idempotency_key" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batch_consumptions" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "planned_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "consumed_quantity" DECIMAL(14,4) NOT NULL,
    "base_quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inventory_issue_id" TEXT,
    "inventory_transaction_id" TEXT,
    "idempotency_key" VARCHAR(100),
    "consumed_by_id" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "production_batch_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batch_status_history" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "from_status" "ProductionBatchStatus",
    "to_status" "ProductionBatchStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_batch_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_execution_entries" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "entry_type" "ProductionExecutionEntryType" NOT NULL,
    "good_quantity" DECIMAL(14,4),
    "rejected_quantity" DECIMAL(14,4),
    "wastage_quantity" DECIMAL(14,4),
    "reason" TEXT,
    "notes" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_execution_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_number_sequences_prefix_financial_year_key" ON "production_batch_number_sequences"("prefix", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_batch_number_key" ON "production_batches"("batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_idempotency_key_key" ON "production_batches"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_completion_idempotency_key_key" ON "production_batches"("completion_idempotency_key");

-- CreateIndex
CREATE INDEX "production_batches_work_order_id_idx" ON "production_batches"("work_order_id");

-- CreateIndex
CREATE INDEX "production_batches_product_variant_id_idx" ON "production_batches"("product_variant_id");

-- CreateIndex
CREATE INDEX "production_batches_warehouse_id_idx" ON "production_batches"("warehouse_id");

-- CreateIndex
CREATE INDEX "production_batches_status_idx" ON "production_batches"("status");

-- CreateIndex
CREATE INDEX "production_batches_operator_id_idx" ON "production_batches"("operator_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_consumptions_idempotency_key_key" ON "production_batch_consumptions"("idempotency_key");

-- CreateIndex
CREATE INDEX "production_batch_consumptions_production_batch_id_idx" ON "production_batch_consumptions"("production_batch_id");

-- CreateIndex
CREATE INDEX "production_batch_consumptions_inventory_item_id_idx" ON "production_batch_consumptions"("inventory_item_id");

-- CreateIndex
CREATE INDEX "production_batch_consumptions_batch_id_idx" ON "production_batch_consumptions"("batch_id");

-- CreateIndex
CREATE INDEX "production_batch_status_history_production_batch_id_idx" ON "production_batch_status_history"("production_batch_id");

-- CreateIndex
CREATE INDEX "production_execution_entries_production_batch_id_idx" ON "production_execution_entries"("production_batch_id");

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_bom_version_id_fkey" FOREIGN KEY ("bom_version_id") REFERENCES "bom_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_finished_goods_batch_id_fkey" FOREIGN KEY ("finished_goods_batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_consumptions" ADD CONSTRAINT "production_batch_consumptions_consumed_by_id_fkey" FOREIGN KEY ("consumed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_status_history" ADD CONSTRAINT "production_batch_status_history_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_status_history" ADD CONSTRAINT "production_batch_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_execution_entries" ADD CONSTRAINT "production_execution_entries_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_execution_entries" ADD CONSTRAINT "production_execution_entries_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
