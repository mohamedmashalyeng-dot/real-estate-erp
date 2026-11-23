-- Select the ERP database in phpMyAdmin before importing this file.
-- Adds only missing Facebook columns/index. Existing records are untouched.
-- Safe to import again, including after a partially applied schema update.

SET @facebook_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
      AND COLUMN_NAME = 'facebookPageId'),
  'SELECT 1',
  'ALTER TABLE `OrganizationSettings` ADD COLUMN `facebookPageId` VARCHAR(191) NULL'
);
PREPARE facebook_schema_stmt FROM @facebook_schema_sql;
EXECUTE facebook_schema_stmt;
DEALLOCATE PREPARE facebook_schema_stmt;

SET @facebook_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
      AND COLUMN_NAME = 'facebookPageName'),
  'SELECT 1',
  'ALTER TABLE `OrganizationSettings` ADD COLUMN `facebookPageName` VARCHAR(191) NULL'
);
PREPARE facebook_schema_stmt FROM @facebook_schema_sql;
EXECUTE facebook_schema_stmt;
DEALLOCATE PREPARE facebook_schema_stmt;

SET @facebook_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
      AND COLUMN_NAME = 'facebookPageAccessToken'),
  'SELECT 1',
  'ALTER TABLE `OrganizationSettings` ADD COLUMN `facebookPageAccessToken` LONGTEXT NULL'
);
PREPARE facebook_schema_stmt FROM @facebook_schema_sql;
EXECUTE facebook_schema_stmt;
DEALLOCATE PREPARE facebook_schema_stmt;

SET @facebook_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
      AND COLUMN_NAME = 'facebookLeadsSyncedAt'),
  'SELECT 1',
  'ALTER TABLE `OrganizationSettings` ADD COLUMN `facebookLeadsSyncedAt` DATETIME(3) NULL'
);
PREPARE facebook_schema_stmt FROM @facebook_schema_sql;
EXECUTE facebook_schema_stmt;
DEALLOCATE PREPARE facebook_schema_stmt;

SET @facebook_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
      AND INDEX_NAME = 'OrganizationSettings_facebookPageId_key'),
  'SELECT 1',
  'CREATE UNIQUE INDEX `OrganizationSettings_facebookPageId_key` ON `OrganizationSettings` (`facebookPageId`)'
);
PREPARE facebook_schema_stmt FROM @facebook_schema_sql;
EXECUTE facebook_schema_stmt;
DEALLOCATE PREPARE facebook_schema_stmt;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrganizationSettings'
  AND COLUMN_NAME IN ('facebookPageId', 'facebookPageName',
    'facebookPageAccessToken', 'facebookLeadsSyncedAt')
ORDER BY COLUMN_NAME;
