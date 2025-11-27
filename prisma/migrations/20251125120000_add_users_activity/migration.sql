-- CreateTable
CREATE TABLE `users_activity` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activityType` ENUM('VESSEL_ADDED', 'DRYDOCK_REQUESTED', 'SHIPYARD_BOOKED', 'AUTHORITY_REQUESTED', 'RECERTIFICATION_REQUESTED', 'DOCUMENT_ADDED') NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'Wrench',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `users_activity_userId_fkey`(`userId`),
    INDEX `users_activity_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users_activity` ADD CONSTRAINT `users_activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


