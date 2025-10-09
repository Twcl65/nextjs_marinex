-- CreateTable
CREATE TABLE `drydock_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `companyLogoUrl` VARCHAR(191) NULL,
    `vesselName` VARCHAR(191) NOT NULL,
    `imoNumber` VARCHAR(191) NOT NULL,
    `flag` VARCHAR(191) NOT NULL,
    `shipType` VARCHAR(191) NOT NULL,
    `vesselImageUrl` VARCHAR(191) NULL,
    `priorityLevel` ENUM('NORMAL', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL',
    `servicesNeeded` JSON NOT NULL,
    `scopeOfWorkUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_requests` ADD CONSTRAINT `drydock_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_requests` ADD CONSTRAINT `drydock_requests_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `ship_vessels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
