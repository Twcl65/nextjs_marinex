-- CreateTable
CREATE TABLE `drydock_service_reschedules` (
    `id` VARCHAR(191) NOT NULL,
    `drydockServiceId` VARCHAR(191) NOT NULL,
    `previousStartDate` DATETIME(3) NOT NULL,
    `newStartDate` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `drydock_service_reschedule_serviceId_fkey`(`drydockServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_service_reschedules` ADD CONSTRAINT `drydock_service_reschedules_drydockServiceId_fkey` FOREIGN KEY (`drydockServiceId`) REFERENCES `drydock_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
