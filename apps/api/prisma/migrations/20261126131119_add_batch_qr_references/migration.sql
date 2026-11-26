-- CreateTable
CREATE TABLE "batch_qr_references" (
    "id" TEXT NOT NULL,
    "production_batch_id" TEXT NOT NULL,
    "reference_token" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "revoked_by_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_qr_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_qr_references_reference_token_key" ON "batch_qr_references"("reference_token");

-- CreateIndex
CREATE INDEX "batch_qr_references_production_batch_id_is_active_idx" ON "batch_qr_references"("production_batch_id", "is_active");

-- AddForeignKey
ALTER TABLE "batch_qr_references" ADD CONSTRAINT "batch_qr_references_production_batch_id_fkey" FOREIGN KEY ("production_batch_id") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
