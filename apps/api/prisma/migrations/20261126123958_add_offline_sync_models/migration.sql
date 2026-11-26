-- CreateEnum
CREATE TYPE "SyncOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED', 'CONFLICT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncConflictCategory" AS ENUM ('RECORD_MODIFIED', 'STOCK_UNAVAILABLE', 'INSUFFICIENT_PERMISSION', 'INVALID_STATE_TRANSITION', 'MASTER_DATA_CHANGED', 'BATCH_ALREADY_COMPLETED', 'DUPLICATE_OPERATION', 'VALIDATION_FAILED');

-- CreateTable
CREATE TABLE "sync_idempotency_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "operation_id" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "operation_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(64),
    "status" "SyncOperationStatus" NOT NULL,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "operation_id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "operation_type" VARCHAR(80) NOT NULL,
    "category" "SyncConflictCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "local_payload" JSONB NOT NULL,
    "server_snapshot" JSONB,
    "resolved_at" TIMESTAMP(3),
    "resolution_action" VARCHAR(50),
    "resolved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_idempotency_records_user_id_operation_id_idx" ON "sync_idempotency_records"("user_id", "operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_idempotency_records_user_id_idempotency_key_key" ON "sync_idempotency_records"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "sync_conflicts_user_id_resolved_at_idx" ON "sync_conflicts"("user_id", "resolved_at");

-- CreateIndex
CREATE INDEX "sync_conflicts_operation_id_idx" ON "sync_conflicts"("operation_id");
