-- CreateTable
CREATE TABLE `drydock_mc_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `drydockReport` INTEGER NOT NULL DEFAULT 0,
    `drydockCertificate` INTEGER NOT NULL DEFAULT 0,
    `safetyCertificate` INTEGER NOT NULL DEFAULT 0,
    `vesselPlans` INTEGER NOT NULL DEFAULT 0,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `isRead` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_mc_notifications_userId_fkey`(`userId`),
    INDEX `drydock_mc_notifications_vesselId_fkey`(`vesselId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_mc_notifications` ADD CONSTRAINT `drydock_mc_notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_mc_notifications` ADD CONSTRAINT `drydock_mc_notifications_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `ship_vessels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
