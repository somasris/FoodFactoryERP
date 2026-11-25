-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "production_plans" (
    "id" TEXT NOT NULL,
    "plan_number" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150),
    "warehouse_id" TEXT NOT NULL,
    "plan_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_start_date" DATE,
    "target_end_date" DATE,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
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

    CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_items" (
    "id" TEXT NOT NULL,
    "production_plan_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "uom_id" TEXT NOT NULL,
    "demand_quantity" DECIMAL(14,4) NOT NULL,
    "available_fg_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "existing_planned_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "net_requirement_quantity" DECIMAL(14,4) NOT NULL,
    "planned_quantity" DECIMAL(14,4) NOT NULL,
    "yield_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "expected_wastage_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estimated_material_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimated_overhead_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimated_total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_demand_sources" (
    "id" TEXT NOT NULL,
    "production_plan_item_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_line_id" TEXT NOT NULL,
    "allocated_base_quantity" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "production_plan_demand_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_material_requirements" (
    "id" TEXT NOT NULL,
    "production_plan_id" TEXT NOT NULL,
    "production_plan_item_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "item_type" "ItemType" NOT NULL,
    "required_base_quantity" DECIMAL(14,4) NOT NULL,
    "available_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "net_available_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "shortage_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unit_mwac_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estimated_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "production_plan_material_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_plan_status_history" (
    "id" TEXT NOT NULL,
    "production_plan_id" TEXT NOT NULL,
    "from_status" "ProductionPlanStatus",
    "to_status" "ProductionPlanStatus" NOT NULL,
    "changed_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_plan_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_plans_plan_number_key" ON "production_plans"("plan_number");

-- CreateIndex
CREATE UNIQUE INDEX "production_plans_idempotency_key_key" ON "production_plans"("idempotency_key");

-- CreateIndex
CREATE INDEX "production_plans_warehouse_id_idx" ON "production_plans"("warehouse_id");

-- CreateIndex
CREATE INDEX "production_plans_status_idx" ON "production_plans"("status");

-- CreateIndex
CREATE INDEX "production_plans_plan_date_idx" ON "production_plans"("plan_date");

-- CreateIndex
CREATE INDEX "production_plan_items_product_variant_id_idx" ON "production_plan_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "production_plan_items_bom_version_id_idx" ON "production_plan_items"("bom_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_plan_items_production_plan_id_line_number_key" ON "production_plan_items"("production_plan_id", "line_number");

-- CreateIndex
CREATE INDEX "production_plan_demand_sources_sales_order_id_idx" ON "production_plan_demand_sources"("sales_order_id");

-- CreateIndex
CREATE INDEX "production_plan_demand_sources_sales_order_line_id_idx" ON "production_plan_demand_sources"("sales_order_line_id");

-- CreateIndex
CREATE INDEX "production_plan_material_requirements_production_plan_id_idx" ON "production_plan_material_requirements"("production_plan_id");

-- CreateIndex
CREATE INDEX "production_plan_material_requirements_inventory_item_id_idx" ON "production_plan_material_requirements"("inventory_item_id");

-- CreateIndex
CREATE INDEX "production_plan_status_history_production_plan_id_idx" ON "production_plan_status_history"("production_plan_id");

-- AddForeignKey
ALTER TABLE "production_plans" ADD CONSTRAINT "production_plans_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_production_plan_id_fkey" FOREIGN KEY ("production_plan_id") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_bom_version_id_fkey" FOREIGN KEY ("bom_version_id") REFERENCES "bom_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_items" ADD CONSTRAINT "production_plan_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_demand_sources" ADD CONSTRAINT "production_plan_demand_sources_production_plan_item_id_fkey" FOREIGN KEY ("production_plan_item_id") REFERENCES "production_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_demand_sources" ADD CONSTRAINT "production_plan_demand_sources_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_demand_sources" ADD CONSTRAINT "production_plan_demand_sources_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_material_requirements" ADD CONSTRAINT "production_plan_material_requirements_production_plan_id_fkey" FOREIGN KEY ("production_plan_id") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_material_requirements" ADD CONSTRAINT "production_plan_material_requirements_production_plan_item_fkey" FOREIGN KEY ("production_plan_item_id") REFERENCES "production_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_material_requirements" ADD CONSTRAINT "production_plan_material_requirements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_status_history" ADD CONSTRAINT "production_plan_status_history_production_plan_id_fkey" FOREIGN KEY ("production_plan_id") REFERENCES "production_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_plan_status_history" ADD CONSTRAINT "production_plan_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
