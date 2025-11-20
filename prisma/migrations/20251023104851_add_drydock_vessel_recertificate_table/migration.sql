-- CreateTable
CREATE TABLE `drydock_vessel_recertificate` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `vesselName` VARCHAR(191) NOT NULL,
    `vesselImoNumber` VARCHAR(191) NOT NULL,
    `vesselPlansUrl` VARCHAR(191) NULL,
    `drydockReportUrl` VARCHAR(191) NULL,
    `drydockCertificateUrl` VARCHAR(191) NULL,
    `safetyCertificateUrl` VARCHAR(191) NULL,
    `vesselCertificateFile` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `requestedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_vessel_recertificate_userId_fkey`(`userId`),
    INDEX `drydock_vessel_recertificate_vesselId_fkey`(`vesselId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_vessel_recertificate` ADD CONSTRAINT `drydock_vessel_recertificate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_vessel_recertificate` ADD CONSTRAINT `drydock_vessel_recertificate_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `ship_vessels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
