-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "production_plan_items" ADD COLUMN     "work_ordered_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "work_order_number_sequences" (
    "id" TEXT NOT NULL,
    "prefix" VARCHAR(15) NOT NULL DEFAULT 'WO',
    "financial_year" VARCHAR(10) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "work_order_number" VARCHAR(40) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "production_plan_id" TEXT NOT NULL,
    "production_plan_item_id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "planned_quantity" DECIMAL(14,4) NOT NULL,
    "actual_good_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "actual_scrap_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "planned_start_date" DATE,
    "planned_end_date" DATE,
    "production_line" VARCHAR(80),
    "assigned_to_id" TEXT,
    "notes" TEXT,
    "instructions" TEXT,
    "idempotency_key" VARCHAR(100),
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "released_by_id" TEXT,
    "released_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_history" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "from_status" "WorkOrderStatus",
    "to_status" "WorkOrderStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_number_sequences_prefix_financial_year_key" ON "work_order_number_sequences"("prefix", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_work_order_number_key" ON "work_orders"("work_order_number");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_idempotency_key_key" ON "work_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "work_orders_production_plan_id_idx" ON "work_orders"("production_plan_id");

-- CreateIndex
CREATE INDEX "work_orders_production_plan_item_id_idx" ON "work_orders"("production_plan_item_id");

-- CreateIndex
CREATE INDEX "work_orders_product_variant_id_idx" ON "work_orders"("product_variant_id");

-- CreateIndex
CREATE INDEX "work_orders_bom_version_id_idx" ON "work_orders"("bom_version_id");

-- CreateIndex
CREATE INDEX "work_orders_warehouse_id_idx" ON "work_orders"("warehouse_id");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_planned_start_date_idx" ON "work_orders"("planned_start_date");

-- CreateIndex
CREATE INDEX "work_order_status_history_work_order_id_idx" ON "work_order_status_history"("work_order_id");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_production_plan_id_fkey" FOREIGN KEY ("production_plan_id") REFERENCES "production_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_production_plan_item_id_fkey" FOREIGN KEY ("production_plan_item_id") REFERENCES "production_plan_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_bom_version_id_fkey" FOREIGN KEY ("bom_version_id") REFERENCES "bom_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
