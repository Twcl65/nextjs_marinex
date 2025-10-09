-- CreateTable
CREATE TABLE `register_service` (
    `id` VARCHAR(191) NOT NULL,
    `registerId` VARCHAR(191) NOT NULL,
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
ALTER TABLE `register_service` ADD CONSTRAINT `register_service_registerId_fkey` FOREIGN KEY (`registerId`) REFERENCES `register`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
