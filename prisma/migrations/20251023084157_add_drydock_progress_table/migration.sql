-- CreateTable
CREATE TABLE `drydock_progress` (
    `id` VARCHAR(191) NOT NULL,
    `drydockServiceId` VARCHAR(191) NOT NULL,
    `progressLevel` VARCHAR(191) NOT NULL,
    `progressPercent` INTEGER NOT NULL,
    `comment` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `drydock_progress_drydockServiceId_fkey`(`drydockServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_progress` ADD CONSTRAINT `drydock_progress_drydockServiceId_fkey` FOREIGN KEY (`drydockServiceId`) REFERENCES `drydock_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
