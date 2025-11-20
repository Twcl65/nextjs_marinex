-- Add certificateUrl column to drydock_issued_certificates table
ALTER TABLE `drydock_issued_certificates` 
ADD COLUMN `certificateUrl` VARCHAR(191) NULL;

