-- CreateEnum
CREATE TYPE "StockAuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComplianceDocVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "stock_audits" (
    "id" TEXT NOT NULL,
    "audit_number" VARCHAR(40) NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "StockAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "audit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "idempotency_key" VARCHAR(100),
    "inventory_adjustment_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "posted_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_audit_lines" (
    "id" TEXT NOT NULL,
    "stock_audit_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "inventory_item_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "uom_id" TEXT NOT NULL,
    "expected_base_quantity" DECIMAL(18,4) NOT NULL,
    "counted_base_quantity" DECIMAL(18,4) NOT NULL,
    "variance_base_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "variance_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "variance_reason" "AdjustmentReason",
    "remarks" TEXT,

    CONSTRAINT "stock_audit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "reference_number" VARCHAR(100) NOT NULL,
    "document_date" DATE NOT NULL,
    "expiry_date" DATE,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(36),
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "file_reference" VARCHAR(500) NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "verification_status" "ComplianceDocVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_audits_audit_number_key" ON "stock_audits"("audit_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_audits_idempotency_key_key" ON "stock_audits"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_audits_warehouse_id_idx" ON "stock_audits"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_audits_status_idx" ON "stock_audits"("status");

-- CreateIndex
CREATE INDEX "stock_audits_audit_date_idx" ON "stock_audits"("audit_date");

-- CreateIndex
CREATE INDEX "stock_audit_lines_inventory_item_id_idx" ON "stock_audit_lines"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_audit_lines_stock_audit_id_line_number_key" ON "stock_audit_lines"("stock_audit_id", "line_number");

-- CreateIndex
CREATE INDEX "compliance_documents_category_idx" ON "compliance_documents"("category");

-- CreateIndex
CREATE INDEX "compliance_documents_verification_status_idx" ON "compliance_documents"("verification_status");

-- CreateIndex
CREATE INDEX "compliance_documents_entity_type_entity_id_idx" ON "compliance_documents"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "stock_audits" ADD CONSTRAINT "stock_audits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audits" ADD CONSTRAINT "stock_audits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_lines" ADD CONSTRAINT "stock_audit_lines_stock_audit_id_fkey" FOREIGN KEY ("stock_audit_id") REFERENCES "stock_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
