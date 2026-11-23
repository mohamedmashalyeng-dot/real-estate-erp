ALTER TABLE `OrganizationSettings`
  ADD COLUMN `facebookPageId` VARCHAR(191) NULL,
  ADD COLUMN `facebookPageName` VARCHAR(191) NULL,
  ADD COLUMN `facebookPageAccessToken` LONGTEXT NULL,
  ADD COLUMN `facebookLeadsSyncedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `OrganizationSettings_facebookPageId_key`
  ON `OrganizationSettings`(`facebookPageId`);
