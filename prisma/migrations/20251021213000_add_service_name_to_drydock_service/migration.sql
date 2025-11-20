-- CreateTable
CREATE TABLE `drydock_bookings` (
    `id` VARCHAR(191) NOT NULL,
    `drydockRequestId` VARCHAR(191) NOT NULL,
    `drydockBidId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `shipyardUserId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `bookingDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_bookings_drydockRequestId_fkey`(`drydockRequestId`),
    INDEX `drydock_bookings_drydockBidId_fkey`(`drydockBidId`),
    INDEX `drydock_bookings_userId_fkey`(`userId`),
    INDEX `drydock_bookings_shipyardUserId_fkey`(`shipyardUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drydock_authority_requests` (
    `id` VARCHAR(191) NOT NULL,
    `drydockRequestId` VARCHAR(191) NOT NULL,
    `drydockBookingId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'EXPIRED') NOT NULL DEFAULT 'REQUESTED',
    `requestDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalScopeOfWorkUrl` VARCHAR(191) NULL,
    `authorityCertificate` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_authority_requests_drydockRequestId_fkey`(`drydockRequestId`),
    INDEX `drydock_authority_requests_drydockBookingId_fkey`(`drydockBookingId`),
    INDEX `drydock_authority_requests_userId_fkey`(`userId`),
    INDEX `drydock_authority_requests_vesselId_fkey`(`vesselId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drydock_services` (
    `id` VARCHAR(191) NOT NULL,
    `drydockBidId` VARCHAR(191) NOT NULL,
    `drydockBookingId` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `drydock_services_drydockBidId_fkey`(`drydockBidId`),
    INDEX `drydock_services_drydockBookingId_fkey`(`drydockBookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_bookings` ADD CONSTRAINT `drydock_bookings_drydockBidId_fkey` FOREIGN KEY (`drydockBidId`) REFERENCES `drydock_bids`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_bookings` ADD CONSTRAINT `drydock_bookings_drydockRequestId_fkey` FOREIGN KEY (`drydockRequestId`) REFERENCES `drydock_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_bookings` ADD CONSTRAINT `drydock_bookings_shipyardUserId_fkey` FOREIGN KEY (`shipyardUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_bookings` ADD CONSTRAINT `drydock_bookings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_authority_requests` ADD CONSTRAINT `drydock_authority_requests_drydockBookingId_fkey` FOREIGN KEY (`drydockBookingId`) REFERENCES `drydock_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_authority_requests` ADD CONSTRAINT `drydock_authority_requests_drydockRequestId_fkey` FOREIGN KEY (`drydockRequestId`) REFERENCES `drydock_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_authority_requests` ADD CONSTRAINT `drydock_authority_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_services` ADD CONSTRAINT `drydock_services_drydockBidId_fkey` FOREIGN KEY (`drydockBidId`) REFERENCES `drydock_bids`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_services` ADD CONSTRAINT `drydock_services_drydockBookingId_fkey` FOREIGN KEY (`drydockBookingId`) REFERENCES `drydock_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
