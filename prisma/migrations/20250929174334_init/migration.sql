-- CreateTable
CREATE TABLE `register` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SHIPOWNER', 'SHIPYARD') NOT NULL,
    `status` ENUM('INACTIVE', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'INACTIVE',
    `fullName` VARCHAR(191) NULL,
    `shipyardName` VARCHAR(191) NULL,
    `contactNumber` VARCHAR(191) NULL,
    `officeAddress` VARCHAR(191) NULL,
    `businessRegNumber` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `shipownerVesselInfo` JSON NULL,
    `shipyardServices` JSON NULL,
    `shipyardDryDock` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `register_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
