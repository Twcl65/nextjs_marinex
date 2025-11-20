-- CreateTable
CREATE TABLE `drydock_issued_certificates` (
    `id` VARCHAR(191) NOT NULL,
    `drydockBookingId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `certificateName` VARCHAR(191) NOT NULL,
    `certificateType` VARCHAR(191) NOT NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `issuedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_issued_certificates_vesselId_fkey`(`vesselId`),
    INDEX `drydock_issued_certificates_userId_fkey`(`userId`),
    INDEX `drydock_issued_certificates_drydockBookingId_fkey`(`drydockBookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_issued_certificates` ADD CONSTRAINT `drydock_issued_certificates_vesselId_fkey` FOREIGN KEY (`vesselId`) REFERENCES `ship_vessels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_issued_certificates` ADD CONSTRAINT `drydock_issued_certificates_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_issued_certificates` ADD CONSTRAINT `drydock_issued_certificates_drydockBookingId_fkey` FOREIGN KEY (`drydockBookingId`) REFERENCES `drydock_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
