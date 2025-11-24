/*
  Warnings:

  - You are about to drop the column `parallelDays` on the `drydock_bids` table. All the data in the column will be lost.
  - You are about to drop the column `sequentialDays` on the `drydock_bids` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `drydock_issued_certificates` DROP FOREIGN KEY `drydock_issued_certificates_drydockBookingId_fkey`;

-- AlterTable
ALTER TABLE `drydock_bids` DROP COLUMN `parallelDays`,
    DROP COLUMN `sequentialDays`,
    ADD COLUMN `additionalCosts` JSON NULL,
    ADD COLUMN `contractConditions` JSON NULL,
    ADD COLUMN `pricingBreakdown` JSON NULL,
    ADD COLUMN `requiredDocumentation` JSON NULL,
    ADD COLUMN `scheduleDetails` JSON NULL,
    ADD COLUMN `taxesAndFees` JSON NULL;
