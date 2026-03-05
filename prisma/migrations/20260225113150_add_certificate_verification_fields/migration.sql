/*
  Warnings:

  - A unique constraint covering the columns `[certificateId]` on the table `drydock_vessel_recertificate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `drydock_vessel_recertificate` ADD COLUMN `certificateExpiry` DATETIME(3) NULL,
    ADD COLUMN `certificateId` VARCHAR(191) NULL,
    ADD COLUMN `certificateIssuedAt` DATETIME(3) NULL,
    ADD COLUMN `certificateRevoked` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `drydock_vessel_recertificate_certificateId_key` ON `drydock_vessel_recertificate`(`certificateId`);
