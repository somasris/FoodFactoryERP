-- CreateEnum
CREATE TYPE "LabelSizePreset" AS ENUM ('SMALL_PRODUCT', 'STANDARD_BATCH', 'LARGE_CARTON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LabelGenerationType" AS ENUM ('ORIGINAL', 'REPRINT');

-- CreateTable
CREATE TABLE "batch_label_templates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "size_preset" "LabelSizePreset" NOT NULL DEFAULT 'STANDARD_BATCH',
    "width_mm" DECIMAL(6,2) NOT NULL,
    "height_mm" DECIMAL(6,2) NOT NULL,
    "logo_placement" VARCHAR(20) NOT NULL DEFAULT 'TOP_LEFT',
    "include_qr" BOOLEAN NOT NULL DEFAULT true,
    "include_barcode" BOOLEAN NOT NULL DEFAULT true,
    "layout_config" JSONB NOT NULL,
    "default_storage_instructions" VARCHAR(255),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_label_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "size_preset" "LabelSizePreset" NOT NULL,
    "width_mm" DECIMAL(6,2) NOT NULL,
    "height_mm" DECIMAL(6,2) NOT NULL,
    "logo_placement" VARCHAR(20) NOT NULL,
    "include_qr" BOOLEAN NOT NULL,
    "include_barcode" BOOLEAN NOT NULL,
    "layout_config" JSONB NOT NULL,
    "default_storage_instructions" VARCHAR(255),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_label_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_label_records" (
    "id" TEXT NOT NULL,
    "label_number" VARCHAR(40) NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version_number" INTEGER NOT NULL,
    "generation_type" "LabelGenerationType" NOT NULL DEFAULT 'ORIGINAL',
    "parent_label_id" TEXT,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "quality_status_snapshot" VARCHAR(40) NOT NULL,
    "qr_reference_token" VARCHAR(64),
    "barcode_value" VARCHAR(80),
    "label_snapshot" JSONB NOT NULL,
    "generated_by_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(100),

    CONSTRAINT "batch_label_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_label_templates_code_key" ON "batch_label_templates"("code");

-- CreateIndex
CREATE INDEX "batch_label_templates_is_active_size_preset_idx" ON "batch_label_templates"("is_active", "size_preset");

-- CreateIndex
CREATE UNIQUE INDEX "batch_label_template_versions_template_id_version_number_key" ON "batch_label_template_versions"("template_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "batch_label_records_label_number_key" ON "batch_label_records"("label_number");

-- CreateIndex
CREATE UNIQUE INDEX "batch_label_records_idempotency_key_key" ON "batch_label_records"("idempotency_key");

-- CreateIndex
CREATE INDEX "batch_label_records_production_batch_id_generated_at_idx" ON "batch_label_records"("production_batch_id", "generated_at");

-- CreateIndex
CREATE INDEX "batch_label_records_factory_id_generated_at_idx" ON "batch_label_records"("factory_id", "generated_at");

-- AddForeignKey
ALTER TABLE "batch_label_template_versions" ADD CONSTRAINT "batch_label_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "batch_label_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_label_records" ADD CONSTRAINT "batch_label_records_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "batch_label_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
