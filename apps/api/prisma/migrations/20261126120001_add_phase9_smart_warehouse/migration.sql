-- CreateEnum
CREATE TYPE "WarehouseLocationType" AS ENUM ('ZONE', 'RACK', 'SHELF', 'BIN', 'STAGING', 'QUARANTINE', 'COLD_STORAGE', 'DISPATCH');

-- CreateEnum
CREATE TYPE "StorageCondition" AS ENUM ('AMBIENT', 'CHILLED', 'FROZEN', 'DRY', 'HAZMAT', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "BinMovementType" AS ENUM ('PUT_AWAY', 'BIN_TRANSFER', 'PICK', 'CYCLE_COUNT_ADJUST');

-- CreateEnum
CREATE TYPE "BarcodeEntityType" AS ENUM ('RAW_MATERIAL', 'PACKAGING_MATERIAL', 'FINISHED_PRODUCT', 'INVENTORY_BATCH', 'WAREHOUSE_BIN', 'PURCHASE_RECEIPT', 'WORK_ORDER');

-- CreateEnum
CREATE TYPE "AbcClass" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "CycleCountFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CycleCountPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "stock_audit_lines" ADD COLUMN     "bin_id" TEXT,
ADD COLUMN     "first_count_quantity" DECIMAL(18,4),
ADD COLUMN     "investigation_notes" TEXT,
ADD COLUMN     "recount_by_id" TEXT,
ADD COLUMN     "recount_quantity" DECIMAL(18,4),
ADD COLUMN     "recounted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stock_audits" ADD COLUMN     "assigned_to_id" TEXT,
ADD COLUMN     "bin_id" TEXT,
ADD COLUMN     "cycle_count_plan_id" TEXT,
ADD COLUMN     "is_blind_count" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recount_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "zone_type" "WarehouseLocationType" NOT NULL DEFAULT 'ZONE',
    "storage_condition" "StorageCondition" NOT NULL DEFAULT 'AMBIENT',
    "is_temperature_controlled" BOOLEAN NOT NULL DEFAULT false,
    "temperature_min_c" DECIMAL(6,2),
    "temperature_max_c" DECIMAL(6,2),
    "allergen_profile" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_racks" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "aisle" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_shelves" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level_number" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "shelf_id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location_type" "WarehouseLocationType" NOT NULL DEFAULT 'BIN',
    "storage_condition" "StorageCondition" NOT NULL DEFAULT 'AMBIENT',
    "capacity_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "capacity_uom_id" TEXT,
    "is_temperature_controlled" BOOLEAN NOT NULL DEFAULT false,
    "allergen_restriction" VARCHAR(200),
    "allow_mixed_items" BOOLEAN NOT NULL DEFAULT true,
    "allow_mixed_batches" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_stock_allocations" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bin_stock_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_movements" (
    "id" TEXT NOT NULL,
    "movement_number" VARCHAR(40) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "movement_type" "BinMovementType" NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "from_bin_id" TEXT,
    "to_bin_id" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "reference_type" VARCHAR(40),
    "reference_id" VARCHAR(60),
    "idempotency_key" VARCHAR(100),
    "performed_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_labels" (
    "id" TEXT NOT NULL,
    "barcode_value" VARCHAR(120) NOT NULL,
    "qr_payload" TEXT,
    "entity_type" "BarcodeEntityType" NOT NULL,
    "entity_id" VARCHAR(80) NOT NULL,
    "warehouse_id" TEXT,
    "label_format" VARCHAR(20) NOT NULL DEFAULT 'CODE128',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barcode_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_plans" (
    "id" TEXT NOT NULL,
    "plan_number" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "abc_class" "AbcClass",
    "frequency" "CycleCountFrequency" NOT NULL,
    "is_blind_count" BOOLEAN NOT NULL DEFAULT false,
    "bin_id" TEXT,
    "assigned_to_id" TEXT,
    "next_run_date" TIMESTAMP(3) NOT NULL,
    "last_run_date" TIMESTAMP(3),
    "status" "CycleCountPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_count_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_zones_warehouse_id_is_active_idx" ON "warehouse_zones"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_id_code_key" ON "warehouse_zones"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_racks_warehouse_id_zone_id_idx" ON "warehouse_racks"("warehouse_id", "zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_racks_zone_id_code_key" ON "warehouse_racks"("zone_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_shelves_warehouse_id_rack_id_idx" ON "warehouse_shelves"("warehouse_id", "rack_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_shelves_rack_id_code_key" ON "warehouse_shelves"("rack_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_bins_shelf_id_idx" ON "warehouse_bins"("shelf_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_warehouse_id_is_active_idx" ON "warehouse_bins"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bins_warehouse_id_code_key" ON "warehouse_bins"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "bin_stock_allocations_warehouse_id_inventory_item_id_batch__idx" ON "bin_stock_allocations"("warehouse_id", "inventory_item_id", "batch_id");

-- CreateIndex
CREATE INDEX "bin_stock_allocations_bin_id_idx" ON "bin_stock_allocations"("bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_stock_allocations_bin_id_inventory_item_id_batch_id_key" ON "bin_stock_allocations"("bin_id", "inventory_item_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_movements_movement_number_key" ON "bin_movements"("movement_number");

-- CreateIndex
CREATE UNIQUE INDEX "bin_movements_idempotency_key_key" ON "bin_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "bin_movements_warehouse_id_created_at_idx" ON "bin_movements"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "bin_movements_inventory_item_id_idx" ON "bin_movements"("inventory_item_id");

-- CreateIndex
CREATE INDEX "bin_movements_from_bin_id_idx" ON "bin_movements"("from_bin_id");

-- CreateIndex
CREATE INDEX "bin_movements_to_bin_id_idx" ON "bin_movements"("to_bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "barcode_labels_barcode_value_key" ON "barcode_labels"("barcode_value");

-- CreateIndex
CREATE INDEX "barcode_labels_barcode_value_idx" ON "barcode_labels"("barcode_value");

-- CreateIndex
CREATE INDEX "barcode_labels_warehouse_id_idx" ON "barcode_labels"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "barcode_labels_entity_type_entity_id_key" ON "barcode_labels"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_count_plans_plan_number_key" ON "cycle_count_plans"("plan_number");

-- CreateIndex
CREATE INDEX "cycle_count_plans_warehouse_id_status_next_run_date_idx" ON "cycle_count_plans"("warehouse_id", "status", "next_run_date");

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_racks" ADD CONSTRAINT "warehouse_racks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_shelves" ADD CONSTRAINT "warehouse_shelves_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_shelves" ADD CONSTRAINT "warehouse_shelves_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "warehouse_racks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "warehouse_shelves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock_allocations" ADD CONSTRAINT "bin_stock_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock_allocations" ADD CONSTRAINT "bin_stock_allocations_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock_allocations" ADD CONSTRAINT "bin_stock_allocations_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_stock_allocations" ADD CONSTRAINT "bin_stock_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_from_bin_id_fkey" FOREIGN KEY ("from_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_to_bin_id_fkey" FOREIGN KEY ("to_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_movements" ADD CONSTRAINT "bin_movements_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_plans" ADD CONSTRAINT "cycle_count_plans_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_plans" ADD CONSTRAINT "cycle_count_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_plans" ADD CONSTRAINT "cycle_count_plans_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
