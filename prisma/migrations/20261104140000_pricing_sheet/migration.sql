-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "pricingSheetData" JSONB,
ADD COLUMN     "pricingSheetSyncedAt" TIMESTAMP(3),
ADD COLUMN     "pricingSheetUrl" TEXT;

