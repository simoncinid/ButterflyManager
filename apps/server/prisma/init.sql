-- ButterflyManager Database Schema
-- MySQL/MariaDB

-- Disable foreign key checks during table creation
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS `Payment`;
DROP TABLE IF EXISTS `Invoice`;
DROP TABLE IF EXISTS `ProjectTodo`;
DROP TABLE IF EXISTS `TimeEntry`;
DROP TABLE IF EXISTS `Project`;
DROP TABLE IF EXISTS `User`;

-- Create User table
CREATE TABLE `User` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `passwordHash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `User_email_idx` (`email`),
  INDEX `User_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Project table
CREATE TABLE `Project` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `clientName` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `status` ENUM('ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `billingMode` ENUM('FIXED_TOTAL', 'RECURRING_PERIOD', 'HOURLY') NOT NULL,
  `fixedTotalAmount` DECIMAL(12, 2) NULL,
  `recurringAmount` DECIMAL(12, 2) NULL,
  `recurringPeriodType` ENUM('MONTHLY', 'WEEKLY', 'CUSTOM') NULL,
  `hourlyRate` DECIMAL(12, 2) NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `startDate` DATE NULL,
  `endDate` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `Project_userId_idx` (`userId`),
  INDEX `Project_status_idx` (`status`),
  INDEX `Project_createdAt_idx` (`createdAt`),
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create TimeEntry table
CREATE TABLE `TimeEntry` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `projectId` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `endedAt` DATETIME(3) NULL,
  `durationMinutes` INT NULL,
  `note` TEXT NULL,
  `billingPeriodStart` DATE NULL,
  `billingPeriodEnd` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `TimeEntry_projectId_idx` (`projectId`),
  INDEX `TimeEntry_userId_idx` (`userId`),
  INDEX `TimeEntry_startedAt_idx` (`startedAt`),
  INDEX `TimeEntry_createdAt_idx` (`createdAt`),
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create ProjectTodo table
CREATE TABLE `ProjectTodo` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `projectId` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  `dueDate` DATE NULL,
  `completed` BOOLEAN NOT NULL DEFAULT FALSE,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `ProjectTodo_projectId_idx` (`projectId`),
  INDEX `ProjectTodo_completed_idx` (`completed`),
  INDEX `ProjectTodo_dueDate_idx` (`dueDate`),
  INDEX `ProjectTodo_createdAt_idx` (`createdAt`),
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Invoice table
CREATE TABLE `Invoice` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(36) NOT NULL,
  `projectId` VARCHAR(36) NULL,
  `issueDate` DATE NOT NULL,
  `dueDate` DATE NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `externalNumber` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `periodStart` DATE NULL,
  `periodEnd` DATE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `Invoice_userId_idx` (`userId`),
  INDEX `Invoice_projectId_idx` (`projectId`),
  INDEX `Invoice_status_idx` (`status`),
  INDEX `Invoice_issueDate_idx` (`issueDate`),
  INDEX `Invoice_createdAt_idx` (`createdAt`),
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Payment table
CREATE TABLE `Payment` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `invoiceId` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `projectId` VARCHAR(36) NULL,
  `paymentDate` DATE NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `method` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `Payment_invoiceId_idx` (`invoiceId`),
  INDEX `Payment_userId_idx` (`userId`),
  INDEX `Payment_projectId_idx` (`projectId`),
  INDEX `Payment_paymentDate_idx` (`paymentDate`),
  INDEX `Payment_createdAt_idx` (`createdAt`),
  FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
