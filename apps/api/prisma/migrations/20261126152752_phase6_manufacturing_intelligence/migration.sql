-- CreateEnum
CREATE TYPE "AllergenDeclarationStatus" AS ENUM ('KNOWN', 'UNKNOWN', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN     "allergen_snapshot" JSONB;

-- AlterTable
ALTER TABLE "raw_materials" ADD COLUMN     "allergen_status" "AllergenDeclarationStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cross_contact_allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];
