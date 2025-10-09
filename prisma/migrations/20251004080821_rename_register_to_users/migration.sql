/*
  Warnings:

  - You are about to drop the `register` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `register_service` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `register_service` DROP FOREIGN KEY `register_service_registerId_fkey`;

-- DropTable
DROP TABLE `register`;

-- DropTable
DROP TABLE `register_service`;

-- CreateTable
CREATE TABLE `users` (
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
    `certificateBuilder` VARCHAR(191) NULL,
    `certificateRepair` VARCHAR(191) NULL,
    `certificateOther` VARCHAR(191) NULL,
    `shipownerVesselInfo` JSON NULL,
    `shipyardServices` JSON NULL,
    `shipyardDryDock` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_services` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `squareMeters` INTEGER NOT NULL,
    `hours` INTEGER NOT NULL,
    `workers` INTEGER NOT NULL,
    `days` INTEGER NOT NULL,
    `price` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_services` ADD CONSTRAINT `user_services_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
