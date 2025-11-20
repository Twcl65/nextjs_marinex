-- Fix drydock_issued_certificates table structure
-- Run this in MySQL Workbench if the table has issues

-- First, check if table exists and drop if needed (BE CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS `drydock_issued_certificates`;

-- Create the table with proper structure
CREATE TABLE IF NOT EXISTS `drydock_issued_certificates` (
    `id` VARCHAR(191) NOT NULL,
    `drydockBookingId` VARCHAR(191) NOT NULL,
    `vesselId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `certificateName` VARCHAR(191) NOT NULL,
    `certificateType` VARCHAR(191) NOT NULL,
    `issuedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `drydock_issued_certificates_vesselId_fkey`(`vesselId`),
    INDEX `drydock_issued_certificates_userId_fkey`(`userId`),
    INDEX `drydock_issued_certificates_drydockBookingId_fkey`(`drydockBookingId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key constraints
ALTER TABLE `drydock_issued_certificates` 
ADD CONSTRAINT `drydock_issued_certificates_vesselId_fkey` 
FOREIGN KEY (`vesselId`) REFERENCES `ship_vessels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `drydock_issued_certificates` 
ADD CONSTRAINT `drydock_issued_certificates_userId_fkey` 
FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

