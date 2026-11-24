-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('MWAC', 'BATCH_ACTUAL', 'STANDARD');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('RAW_INGREDIENT', 'PACKAGING_PRIMARY', 'PACKAGING_SECONDARY');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAILER', 'DISTRIBUTOR', 'WHOLESALER', 'DIRECT');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING', 'OFFICE', 'DISPATCH');

-- CreateEnum
CREATE TYPE "BOMVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "OverheadCostType" AS ENUM ('LABOUR', 'UTILITY', 'MACHINE_DEPRECIATION', 'DIRECT_OVERHEAD');

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    "is_base_unit" BOOLEAN NOT NULL DEFAULT false,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "from_uom_id" TEXT NOT NULL,
    "to_uom_id" TEXT NOT NULL,
    "multiplier" DECIMAL(18,6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "rate_percentage" DECIMAL(5,2) NOT NULL,
    "cgst_percentage" DECIMAL(5,2) NOT NULL,
    "sgst_percentage" DECIMAL(5,2) NOT NULL,
    "igst_percentage" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_configurations" (
    "id" TEXT NOT NULL,
    "hsn_code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(255),
    "tax_rate_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_categories" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "material_type" "MaterialType" NOT NULL,
    "uom_id" TEXT NOT NULL,
    "hsn_code" VARCHAR(10) NOT NULL,
    "tax_rate_id" TEXT NOT NULL,
    "min_stock_alert" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reorder_quantity" DECIMAL(14,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "base_uom_id" TEXT NOT NULL,
    "hsn_code" VARCHAR(10) NOT NULL,
    "tax_rate_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "net_weight_grams" DECIMAL(10,2) NOT NULL,
    "uom_id" TEXT NOT NULL,
    "default_selling_price" DECIMAL(12,2) NOT NULL,
    "barcode" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "item_type" "ItemType" NOT NULL,
    "raw_material_id" TEXT,
    "product_variant_id" TEXT,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "uom_id" TEXT NOT NULL,
    "valuation_method" "ValuationMethod" NOT NULL DEFAULT 'MWAC',
    "moving_average_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "legal_name" VARCHAR(150) NOT NULL,
    "trade_name" VARCHAR(150),
    "contact_name" VARCHAR(100),
    "email" VARCHAR(100),
    "phone" VARCHAR(20),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_addresses" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "address_type" "AddressType" NOT NULL DEFAULT 'OFFICE',
    "address_line1" VARCHAR(255) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "legal_name" VARCHAR(150) NOT NULL,
    "trade_name" VARCHAR(150),
    "customer_type" "CustomerType" NOT NULL,
    "contact_name" VARCHAR(100),
    "email" VARCHAR(100),
    "phone" VARCHAR(20),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "credit_period_days" INTEGER NOT NULL DEFAULT 15,
    "credit_limit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "address_type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
    "address_line1" VARCHAR(255) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "base_output_quantity" DECIMAL(14,4) NOT NULL,
    "output_uom_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_versions" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "BOMVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATE,
    "expected_good_output" DECIMAL(14,4) NOT NULL,
    "output_uom_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "item_type" "ItemType" NOT NULL,
    "standard_quantity" DECIMAL(14,4) NOT NULL,
    "uom_id" TEXT NOT NULL,
    "scrap_tolerance_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_overheads" (
    "id" TEXT NOT NULL,
    "bom_version_id" TEXT NOT NULL,
    "cost_type" "OverheadCostType" NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "standard_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_overheads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_from_uom_id_to_uom_id_key" ON "unit_conversions"("from_uom_id", "to_uom_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_code_key" ON "tax_rates"("code");

-- CreateIndex
CREATE INDEX "tax_configurations_hsn_code_idx" ON "tax_configurations"("hsn_code");

-- CreateIndex
CREATE INDEX "tax_configurations_tax_rate_id_idx" ON "tax_configurations"("tax_rate_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_categories_code_key" ON "raw_material_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_code_key" ON "raw_materials"("code");

-- CreateIndex
CREATE INDEX "raw_materials_category_id_idx" ON "raw_materials"("category_id");

-- CreateIndex
CREATE INDEX "raw_materials_uom_id_idx" ON "raw_materials"("uom_id");

-- CreateIndex
CREATE INDEX "raw_materials_tax_rate_id_idx" ON "raw_materials"("tax_rate_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_code_key" ON "product_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_base_uom_id_idx" ON "products"("base_uom_id");

-- CreateIndex
CREATE INDEX "products_tax_rate_id_idx" ON "products"("tax_rate_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_uom_id_idx" ON "product_variants"("uom_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_raw_material_id_key" ON "inventory_items"("raw_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_product_variant_id_key" ON "inventory_items"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_code_key" ON "inventory_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_gstin_key" ON "suppliers"("gstin");

-- CreateIndex
CREATE INDEX "supplier_addresses_supplier_id_idx" ON "supplier_addresses"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_gstin_key" ON "customers"("gstin");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "boms_code_key" ON "boms"("code");

-- CreateIndex
CREATE INDEX "boms_product_variant_id_idx" ON "boms"("product_variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_versions_bom_id_version_number_key" ON "bom_versions"("bom_id", "version_number");

-- CreateIndex
CREATE INDEX "bom_items_bom_version_id_idx" ON "bom_items"("bom_version_id");

-- CreateIndex
CREATE INDEX "bom_items_inventory_item_id_idx" ON "bom_items"("inventory_item_id");

-- CreateIndex
CREATE INDEX "bom_overheads_bom_version_id_idx" ON "bom_overheads"("bom_version_id");

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_from_uom_id_fkey" FOREIGN KEY ("from_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_to_uom_id_fkey" FOREIGN KEY ("to_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configurations" ADD CONSTRAINT "tax_configurations_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "raw_material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_output_uom_id_fkey" FOREIGN KEY ("output_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_output_uom_id_fkey" FOREIGN KEY ("output_uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_version_id_fkey" FOREIGN KEY ("bom_version_id") REFERENCES "bom_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_overheads" ADD CONSTRAINT "bom_overheads_bom_version_id_fkey" FOREIGN KEY ("bom_version_id") REFERENCES "bom_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
