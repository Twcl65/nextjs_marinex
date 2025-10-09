-- CreateTable
CREATE TABLE `drydock_bids` (
    `id` VARCHAR(191) NOT NULL,
    `drydockRequestId` VARCHAR(191) NOT NULL,
    `shipyardUserId` VARCHAR(191) NOT NULL,
    `shipyardName` VARCHAR(191) NOT NULL,
    `shipyardAddress` VARCHAR(191) NOT NULL,
    `shipyardContactNumber` VARCHAR(191) NOT NULL,
    `shipyardContactPerson` VARCHAR(191) NULL,
    `shipyardBusinessReg` VARCHAR(191) NULL,
    `shipyardLogoUrl` VARCHAR(191) NULL,
    `certificateBuilder` VARCHAR(191) NULL,
    `certificateRepair` VARCHAR(191) NULL,
    `certificateOther` VARCHAR(191) NULL,
    `servicesOffered` JSON NOT NULL,
    `serviceCalculations` JSON NOT NULL,
    `totalBid` DOUBLE NOT NULL,
    `totalDays` INTEGER NOT NULL,
    `parallelDays` INTEGER NOT NULL,
    `sequentialDays` INTEGER NOT NULL,
    `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `drydock_bids` ADD CONSTRAINT `drydock_bids_drydockRequestId_fkey` FOREIGN KEY (`drydockRequestId`) REFERENCES `drydock_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drydock_bids` ADD CONSTRAINT `drydock_bids_shipyardUserId_fkey` FOREIGN KEY (`shipyardUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
