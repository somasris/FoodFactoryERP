-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "BackupVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "RestoreRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "backup_name" VARCHAR(120) NOT NULL,
    "backup_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "file_path_reference" VARCHAR(500),
    "file_size_bytes" INTEGER,
    "checksum_sha256" VARCHAR(64),
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "verification_status" "BackupVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verified_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "triggered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_requests" (
    "id" TEXT NOT NULL,
    "backup_record_id" TEXT NOT NULL,
    "status" "RestoreRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "recovery_notes" TEXT,
    "environment_label" VARCHAR(50) NOT NULL DEFAULT 'ISOLATED_STAGING',

    CONSTRAINT "restore_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_records_status_idx" ON "backup_records"("status");

-- CreateIndex
CREATE INDEX "backup_records_created_at_idx" ON "backup_records"("created_at");

-- CreateIndex
CREATE INDEX "restore_requests_status_idx" ON "restore_requests"("status");

-- AddForeignKey
ALTER TABLE "restore_requests" ADD CONSTRAINT "restore_requests_backup_record_id_fkey" FOREIGN KEY ("backup_record_id") REFERENCES "backup_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
