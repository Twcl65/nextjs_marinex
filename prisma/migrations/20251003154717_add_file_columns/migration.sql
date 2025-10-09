-- AlterTable
ALTER TABLE `register` ADD COLUMN `certificateBuilder` VARCHAR(191) NULL,
    ADD COLUMN `certificateOther` VARCHAR(191) NULL,
    ADD COLUMN `certificateRepair` VARCHAR(191) NULL;
