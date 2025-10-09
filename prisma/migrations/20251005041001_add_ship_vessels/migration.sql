-- CreateTable
CREATE TABLE `ship_vessels` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `vesselName` VARCHAR(191) NOT NULL,
    `imoNumber` VARCHAR(191) NOT NULL,
    `shipType` VARCHAR(191) NOT NULL,
    `flag` VARCHAR(191) NOT NULL,
    `yearOfBuild` INTEGER NOT NULL,
    `lengthOverall` DOUBLE NOT NULL,
    `grossTonnage` DOUBLE NOT NULL,
    `vesselImageUrl` VARCHAR(191) NULL,
    `vesselCertificationUrl` VARCHAR(191) NULL,
    `vesselPlansUrl` VARCHAR(191) NULL,
    `drydockCertificateUrl` VARCHAR(191) NULL,
    `safetyCertificateUrl` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ship_vessels_imoNumber_key`(`imoNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ship_vessels` ADD CONSTRAINT `ship_vessels_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
