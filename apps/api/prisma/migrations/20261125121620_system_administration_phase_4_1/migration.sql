-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "default_currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
ADD COLUMN     "default_timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN     "financial_year_start_month" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "fssai_license" VARCHAR(30),
ADD COLUMN     "logo_url" VARCHAR(500),
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "registration_number" VARCHAR(100);

-- AlterTable
ALTER TABLE "factories" ADD COLUMN     "email" VARCHAR(100),
ADD COLUMN     "operational_info" JSONB,
ADD COLUMN     "phone" VARCHAR(20);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN     "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "updated_by_id" TEXT,
ADD COLUMN     "value_type" VARCHAR(20) NOT NULL DEFAULT 'STRING',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
