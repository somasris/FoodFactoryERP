-- AlterTable
ALTER TABLE "bom_versions" ADD COLUMN     "expected_wastage_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "yield_percentage" DECIMAL(5,2) NOT NULL DEFAULT 100;
