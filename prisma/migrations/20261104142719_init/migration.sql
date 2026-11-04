-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `image` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `jobTitle` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INVITED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_status_idx`(`status`),
    INDEX `User_isPlatformAdmin_idx`(`isPlatformAdmin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `status` ENUM('ACTIVE', 'TRIAL', 'SUSPENDED', 'CHURNED') NOT NULL DEFAULT 'TRIAL',
    `plan` ENUM('STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE') NOT NULL DEFAULT 'STARTER',
    `aiEnabled` BOOLEAN NOT NULL DEFAULT true,
    `suspendedAt` DATETIME(3) NULL,
    `suspendedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_slug_key`(`slug`),
    INDEX `Organization_status_idx`(`status`),
    INDEX `Organization_plan_idx`(`plan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationSettings` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadSlaHours` INTEGER NOT NULL DEFAULT 24,
    `defaultFollowUpType` ENUM('CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'VIEWING', 'OTHER') NOT NULL DEFAULT 'CALL',
    `autoCreateFollowUpOnNewLead` BOOLEAN NOT NULL DEFAULT true,
    `aiMonthlyTokenBudget` INTEGER NOT NULL DEFAULT 250000,
    `features` JSON NULL,
    `leadsSheetUrl` TEXT NULL,
    `leadsSheetSyncedAt` DATETIME(3) NULL,
    `pricingSheetUrl` TEXT NULL,
    `pricingSheetData` JSON NULL,
    `pricingSheetSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrganizationSettings_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `plan` ENUM('STARTER', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE') NOT NULL DEFAULT 'STARTER',
    `status` ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED') NOT NULL DEFAULT 'TRIALING',
    `seats` INTEGER NOT NULL DEFAULT 5,
    `currentPeriodStart` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentPeriodEnd` DATETIME(3) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `externalCustomerId` VARCHAR(191) NULL,
    `externalSubscriptionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_organizationId_key`(`organizationId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageRecord` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `metric` ENUM('AI_TOKENS', 'AI_REQUESTS', 'ACTIVE_USERS', 'STORAGE_MB') NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UsageRecord_organizationId_metric_idx`(`organizationId`, `metric`),
    UNIQUE INDEX `UsageRecord_organizationId_metric_periodStart_key`(`organizationId`, `metric`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'INVITED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Membership_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Membership_userId_status_idx`(`userId`, `status`),
    INDEX `Membership_roleId_idx`(`roleId`),
    UNIQUE INDEX `Membership_userId_organizationId_key`(`userId`, `organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Role_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `Role_organizationId_slug_key`(`organizationId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permission_key_key`(`key`),
    INDEX `Permission_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` CHAR(36) NOT NULL,
    `permissionId` CHAR(36) NOT NULL,

    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `invitedById` CHAR(36) NULL,
    `createdById` CHAR(36) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `acceptedByUserId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`),
    INDEX `Invitation_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Invitation_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `budgetMin` DECIMAL(18, 2) NULL,
    `budgetMax` DECIMAL(18, 2) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `preferredLocation` VARCHAR(191) NULL,
    `preferredProjectId` CHAR(36) NULL,
    `propertyType` ENUM('APARTMENT', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'STUDIO', 'OFFICE', 'RETAIL', 'CHALET', 'LAND') NULL,
    `bedrooms` INTEGER NULL,
    `source` ENUM('FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'TIKTOK', 'WEBSITE', 'WHATSAPP', 'REFERRAL', 'WALK_IN', 'PROPERTY_PORTAL', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `campaignId` CHAR(36) NULL,
    `stage` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'VIEWING', 'NEGOTIATION', 'RESERVATION', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
    `assignedToId` CHAR(36) NULL,
    `score` INTEGER NOT NULL DEFAULT 0,
    `temperature` ENUM('HOT', 'WARM', 'COLD') NOT NULL DEFAULT 'COLD',
    `priorityScore` INTEGER NOT NULL DEFAULT 0,
    `priorityCategory` ENUM('HOT', 'WARM', 'COLD') NOT NULL DEFAULT 'COLD',
    `priorityFactors` JSON NULL,
    `priorityComputedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `lostReason` TEXT NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NULL,
    `lastContactedAt` DATETIME(3) NULL,
    `qualifiedAt` DATETIME(3) NULL,
    `wonAt` DATETIME(3) NULL,
    `externalRef` VARCHAR(191) NULL,
    `externalHash` VARCHAR(191) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_organizationId_stage_idx`(`organizationId`, `stage`),
    INDEX `Lead_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `Lead_organizationId_assignedToId_idx`(`organizationId`, `assignedToId`),
    INDEX `Lead_organizationId_nextFollowUpAt_idx`(`organizationId`, `nextFollowUpAt`),
    INDEX `Lead_organizationId_source_idx`(`organizationId`, `source`),
    INDEX `Lead_organizationId_priorityScore_idx`(`organizationId`, `priorityScore`),
    INDEX `Lead_campaignId_idx`(`campaignId`),
    INDEX `Lead_phone_idx`(`phone`),
    INDEX `Lead_email_idx`(`email`),
    UNIQUE INDEX `Lead_organizationId_externalRef_key`(`organizationId`, `externalRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadActivity` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `type` ENUM('CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'NOTE', 'STAGE_CHANGE', 'ASSIGNMENT_CHANGE', 'RESERVATION', 'SALE', 'PAYMENT', 'SYSTEM') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `outcome` TEXT NULL,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadActivity_organizationId_occurredAt_idx`(`organizationId`, `occurredAt`),
    INDEX `LeadActivity_leadId_occurredAt_idx`(`leadId`, `occurredAt`),
    INDEX `LeadActivity_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FollowUp` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `assignedToId` CHAR(36) NOT NULL,
    `type` ENUM('CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'VIEWING', 'OTHER') NOT NULL DEFAULT 'CALL',
    `dueAt` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'MISSED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` CHAR(36) NULL,
    `createdById` CHAR(36) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FollowUp_organizationId_dueAt_status_idx`(`organizationId`, `dueAt`, `status`),
    INDEX `FollowUp_organizationId_assignedToId_status_idx`(`organizationId`, `assignedToId`, `status`),
    INDEX `FollowUp_leadId_idx`(`leadId`),
    INDEX `FollowUp_status_dueAt_idx`(`status`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'TIKTOK', 'WEBSITE', 'WHATSAPP', 'REFERRAL', 'PORTAL', 'OTHER') NOT NULL,
    `cost` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `externalId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Campaign_organizationId_startDate_idx`(`organizationId`, `startDate`),
    INDEX `Campaign_platform_idx`(`platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `developer` VARCHAR(191) NULL,
    `locationCity` VARCHAR(191) NULL,
    `locationCountry` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `description` TEXT NULL,
    `status` ENUM('PLANNED', 'UNDER_CONSTRUCTION', 'READY', 'SOLD_OUT', 'ON_HOLD') NOT NULL DEFAULT 'PLANNED',
    `launchDate` DATETIME(3) NULL,
    `expectedDeliveryDate` DATETIME(3) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `startingPrice` DECIMAL(18, 2) NULL,
    `totalUnits` INTEGER NOT NULL DEFAULT 0,
    `coverImageUrl` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Project_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `Project_locationCity_idx`(`locationCity`),
    UNIQUE INDEX `Project_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Building` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `floors` INTEGER NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Building_organizationId_idx`(`organizationId`),
    INDEX `Building_projectId_idx`(`projectId`),
    UNIQUE INDEX `Building_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `projectId` CHAR(36) NOT NULL,
    `buildingId` CHAR(36) NULL,
    `unitCode` VARCHAR(191) NOT NULL,
    `floor` INTEGER NULL,
    `type` ENUM('APARTMENT', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'STUDIO', 'OFFICE', 'RETAIL', 'CHALET', 'LAND') NOT NULL,
    `bedrooms` INTEGER NOT NULL DEFAULT 0,
    `bathrooms` INTEGER NOT NULL DEFAULT 0,
    `areaSqm` DECIMAL(10, 2) NOT NULL,
    `price` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    `view` ENUM('SEA', 'GARDEN', 'POOL', 'CITY', 'LANDSCAPE', 'STREET', 'NONE') NOT NULL DEFAULT 'NONE',
    `finishing` ENUM('CORE_SHELL', 'SEMI_FINISHED', 'FULLY_FINISHED', 'FURNISHED') NOT NULL DEFAULT 'SEMI_FINISHED',
    `availableFrom` DATETIME(3) NULL,
    `statusChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Unit_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Unit_organizationId_projectId_status_idx`(`organizationId`, `projectId`, `status`),
    INDEX `Unit_organizationId_type_bedrooms_idx`(`organizationId`, `type`, `bedrooms`),
    INDEX `Unit_organizationId_price_idx`(`organizationId`, `price`),
    INDEX `Unit_projectId_buildingId_idx`(`projectId`, `buildingId`),
    INDEX `Unit_buildingId_idx`(`buildingId`),
    UNIQUE INDEX `Unit_organizationId_unitCode_key`(`organizationId`, `unitCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reservation` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `unitId` CHAR(36) NOT NULL,
    `salespersonId` CHAR(36) NOT NULL,
    `reservedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `status` ENUM('ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'CONVERTED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Reservation_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Reservation_organizationId_expiresAt_idx`(`organizationId`, `expiresAt`),
    INDEX `Reservation_leadId_idx`(`leadId`),
    INDEX `Reservation_unitId_status_idx`(`unitId`, `status`),
    INDEX `Reservation_salespersonId_idx`(`salespersonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sale` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `unitId` CHAR(36) NOT NULL,
    `reservationId` CHAR(36) NULL,
    `salespersonId` CHAR(36) NOT NULL,
    `salePrice` DECIMAL(18, 2) NOT NULL,
    `discount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `contractValue` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `commissionRate` DECIMAL(5, 2) NULL,
    `commissionAmount` DECIMAL(18, 2) NULL,
    `saleDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONTRACTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `approvedById` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sale_reservationId_key`(`reservationId`),
    INDEX `Sale_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Sale_organizationId_saleDate_idx`(`organizationId`, `saleDate`),
    INDEX `Sale_organizationId_salespersonId_idx`(`organizationId`, `salespersonId`),
    INDEX `Sale_leadId_idx`(`leadId`),
    INDEX `Sale_unitId_idx`(`unitId`),
    UNIQUE INDEX `Sale_organizationId_reference_key`(`organizationId`, `reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentPlan` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `saleId` CHAR(36) NOT NULL,
    `totalAmount` DECIMAL(18, 2) NOT NULL,
    `downPayment` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `installmentsCount` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `notes` TEXT NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentPlan_saleId_key`(`saleId`),
    INDEX `PaymentPlan_organizationId_startDate_idx`(`organizationId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Installment` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `paymentPlanId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `paidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UPCOMING',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Installment_organizationId_dueDate_status_idx`(`organizationId`, `dueDate`, `status`),
    INDEX `Installment_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `Installment_paymentPlanId_idx`(`paymentPlanId`),
    UNIQUE INDEX `Installment_paymentPlanId_sequence_key`(`paymentPlanId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `saleId` CHAR(36) NOT NULL,
    `installmentId` CHAR(36) NULL,
    `leadId` CHAR(36) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER') NOT NULL DEFAULT 'CASH',
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `receivedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_organizationId_paidAt_idx`(`organizationId`, `paidAt`),
    INDEX `Payment_organizationId_saleId_idx`(`organizationId`, `saleId`),
    INDEX `Payment_installmentId_idx`(`installmentId`),
    INDEX `Payment_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExchangeRate` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `baseCurrency` VARCHAR(3) NOT NULL,
    `quoteCurrency` VARCHAR(3) NOT NULL,
    `rate` DECIMAL(18, 8) NOT NULL,
    `asOf` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ExchangeRate_organizationId_baseCurrency_quoteCurrency_idx`(`organizationId`, `baseCurrency`, `quoteCurrency`),
    UNIQUE INDEX `ExchangeRate_organizationId_baseCurrency_quoteCurrency_asOf_key`(`organizationId`, `baseCurrency`, `quoteCurrency`, `asOf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` ENUM('LEAD_ASSIGNED', 'FOLLOW_UP_DUE', 'FOLLOW_UP_OVERDUE', 'RESERVATION_EXPIRING', 'RESERVATION_EXPIRED', 'SALE_APPROVAL_REQUIRED', 'SALE_APPROVED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'PAYMENT_RECEIVED', 'AI_INSIGHT', 'SYSTEM') NOT NULL,
    `title` TEXT NOT NULL,
    `body` TEXT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `link` TEXT NULL,
    `metadata` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_organizationId_userId_readAt_idx`(`organizationId`, `userId`, `readAt`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Notification_organizationId_type_idx`(`organizationId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NULL,
    `userId` CHAR(36) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `AuditLog_organizationId_entityType_entityId_idx`(`organizationId`, `entityType`, `entityId`),
    INDEX `AuditLog_organizationId_action_idx`(`organizationId`, `action`),
    INDEX `AuditLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationRule` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `event` ENUM('LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'FOLLOWUP_OVERDUE', 'RESERVATION_CREATED', 'RESERVATION_EXPIRING', 'SALE_CREATED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'UNIT_AVAILABLE') NOT NULL,
    `conditions` JSON NOT NULL,
    `actions` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutomationRule_organizationId_event_enabled_idx`(`organizationId`, `event`, `enabled`),
    UNIQUE INDEX `AutomationRule_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationExecution` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `ruleId` CHAR(36) NULL,
    `event` ENUM('LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'FOLLOWUP_OVERDUE', 'RESERVATION_CREATED', 'RESERVATION_EXPIRING', 'SALE_CREATED', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'UNIT_AVAILABLE') NOT NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'SKIPPED') NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `AutomationExecution_organizationId_startedAt_idx`(`organizationId`, `startedAt`),
    INDEX `AutomationExecution_organizationId_event_status_idx`(`organizationId`, `event`, `status`),
    INDEX `AutomationExecution_ruleId_idx`(`ruleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIConversation` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `title` TEXT NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AIConversation_organizationId_userId_updatedAt_idx`(`organizationId`, `userId`, `updatedAt`),
    INDEX `AIConversation_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIMessage` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `conversationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `role` ENUM('USER', 'ASSISTANT', 'TOOL', 'SYSTEM') NOT NULL,
    `content` TEXT NOT NULL,
    `toolName` VARCHAR(191) NULL,
    `toolInput` JSON NULL,
    `toolOutput` JSON NULL,
    `provider` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `promptTokens` INTEGER NULL,
    `completionTokens` INTEGER NULL,
    `latencyMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `AIMessage_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `AIMessage_organizationId_role_idx`(`organizationId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIInsight` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `type` ENUM('SALES_TREND', 'LEAD_FOLLOWUP', 'COLLECTIONS', 'EMPLOYEE_PERFORMANCE', 'INVENTORY_AGING', 'LEAD_SOURCE_ROI', 'FORECAST') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL', 'POSITIVE') NOT NULL DEFAULT 'INFO',
    `title` TEXT NOT NULL,
    `summary` TEXT NOT NULL,
    `data` JSON NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dismissedAt` DATETIME(3) NULL,
    `dismissedById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AIInsight_organizationId_generatedAt_idx`(`organizationId`, `generatedAt`),
    INDEX `AIInsight_organizationId_severity_dismissedAt_idx`(`organizationId`, `severity`, `dismissedAt`),
    UNIQUE INDEX `AIInsight_organizationId_dedupeKey_key`(`organizationId`, `dedupeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationSettings` ADD CONSTRAINT `OrganizationSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageRecord` ADD CONSTRAINT `UsageRecord_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_preferredProjectId_fkey` FOREIGN KEY (`preferredProjectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadActivity` ADD CONSTRAINT `LeadActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FollowUp` ADD CONSTRAINT `FollowUp_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Building` ADD CONSTRAINT `Building_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Building` ADD CONSTRAINT `Building_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `Building`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_salespersonId_fkey` FOREIGN KEY (`salespersonId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_salespersonId_fkey` FOREIGN KEY (`salespersonId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installment` ADD CONSTRAINT `Installment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installment` ADD CONSTRAINT `Installment_paymentPlanId_fkey` FOREIGN KEY (`paymentPlanId`) REFERENCES `PaymentPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `Installment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeRate` ADD CONSTRAINT `ExchangeRate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRule` ADD CONSTRAINT `AutomationRule_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationRule` ADD CONSTRAINT `AutomationRule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationExecution` ADD CONSTRAINT `AutomationExecution_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationExecution` ADD CONSTRAINT `AutomationExecution_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `AutomationRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIConversation` ADD CONSTRAINT `AIConversation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIConversation` ADD CONSTRAINT `AIConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIMessage` ADD CONSTRAINT `AIMessage_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIMessage` ADD CONSTRAINT `AIMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `AIConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIMessage` ADD CONSTRAINT `AIMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIInsight` ADD CONSTRAINT `AIInsight_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIInsight` ADD CONSTRAINT `AIInsight_dismissedById_fkey` FOREIGN KEY (`dismissedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
