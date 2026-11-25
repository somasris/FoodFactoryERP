-- CreateEnum
CREATE TYPE "UserRegistrationStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "registration_status" "UserRegistrationStatus" NOT NULL DEFAULT 'APPROVED';
