-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "externalHash" TEXT,
ADD COLUMN     "externalRef" TEXT;

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "leadsSheetSyncedAt" TIMESTAMP(3),
ADD COLUMN     "leadsSheetUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_externalRef_key" ON "Lead"("organizationId", "externalRef");

