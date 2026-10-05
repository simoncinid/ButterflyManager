PRAGMA foreign_keys = ON;

CREATE TABLE `User` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `email` TEXT NOT NULL UNIQUE,
  `passwordHash` TEXT NOT NULL,
  `name` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `User_createdAt_idx` ON `User` (`createdAt`);

CREATE TABLE `Project` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `userId` TEXT NOT NULL REFERENCES `User`(`id`) ON DELETE CASCADE,
  `name` TEXT NOT NULL,
  `clientName` TEXT,
  `description` TEXT,
  `status` TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (`status` IN ('ACTIVE', 'PAUSED', 'ARCHIVED')),
  `billingMode` TEXT NOT NULL CHECK (`billingMode` IN ('FIXED_TOTAL', 'RECURRING_PERIOD', 'HOURLY')),
  `fixedTotalAmount` REAL,
  `recurringAmount` REAL,
  `recurringPeriodType` TEXT CHECK (`recurringPeriodType` IN ('MONTHLY', 'WEEKLY', 'CUSTOM')),
  `hourlyRate` REAL,
  `currency` TEXT NOT NULL DEFAULT 'EUR',
  `startDate` TEXT,
  `endDate` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `Project_userId_idx` ON `Project` (`userId`);
CREATE INDEX `Project_status_idx` ON `Project` (`status`);
CREATE INDEX `Project_createdAt_idx` ON `Project` (`createdAt`);

CREATE TABLE `TimeEntry` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `projectId` TEXT NOT NULL REFERENCES `Project`(`id`) ON DELETE CASCADE,
  `userId` TEXT NOT NULL REFERENCES `User`(`id`) ON DELETE CASCADE,
  `startedAt` TEXT NOT NULL,
  `endedAt` TEXT,
  `durationMinutes` INTEGER,
  `note` TEXT,
  `billingPeriodStart` TEXT,
  `billingPeriodEnd` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `TimeEntry_projectId_idx` ON `TimeEntry` (`projectId`);
CREATE INDEX `TimeEntry_userId_idx` ON `TimeEntry` (`userId`);
CREATE INDEX `TimeEntry_startedAt_idx` ON `TimeEntry` (`startedAt`);

CREATE TABLE `ProjectTodo` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `projectId` TEXT NOT NULL REFERENCES `Project`(`id`) ON DELETE CASCADE,
  `title` TEXT NOT NULL,
  `description` TEXT,
  `priority` TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (`priority` IN ('LOW', 'MEDIUM', 'HIGH')),
  `dueDate` TEXT,
  `completed` INTEGER NOT NULL DEFAULT 0,
  `completedAt` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `ProjectTodo_projectId_idx` ON `ProjectTodo` (`projectId`);
CREATE INDEX `ProjectTodo_completed_idx` ON `ProjectTodo` (`completed`);
CREATE INDEX `ProjectTodo_dueDate_idx` ON `ProjectTodo` (`dueDate`);

CREATE TABLE `Invoice` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `userId` TEXT NOT NULL REFERENCES `User`(`id`) ON DELETE CASCADE,
  `projectId` TEXT REFERENCES `Project`(`id`) ON DELETE SET NULL,
  `issueDate` TEXT NOT NULL,
  `dueDate` TEXT,
  `amount` REAL NOT NULL,
  `currency` TEXT NOT NULL DEFAULT 'EUR',
  `status` TEXT NOT NULL DEFAULT 'DRAFT' CHECK (`status` IN ('DRAFT', 'SENT', 'PAID', 'CANCELLED')),
  `externalNumber` TEXT,
  `notes` TEXT,
  `periodStart` TEXT,
  `periodEnd` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `Invoice_userId_idx` ON `Invoice` (`userId`);
CREATE INDEX `Invoice_projectId_idx` ON `Invoice` (`projectId`);
CREATE INDEX `Invoice_status_idx` ON `Invoice` (`status`);
CREATE INDEX `Invoice_issueDate_idx` ON `Invoice` (`issueDate`);

CREATE TABLE `Payment` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `invoiceId` TEXT NOT NULL REFERENCES `Invoice`(`id`) ON DELETE CASCADE,
  `userId` TEXT NOT NULL REFERENCES `User`(`id`) ON DELETE CASCADE,
  `projectId` TEXT REFERENCES `Project`(`id`) ON DELETE SET NULL,
  `paymentDate` TEXT NOT NULL,
  `amount` REAL NOT NULL,
  `currency` TEXT NOT NULL DEFAULT 'EUR',
  `method` TEXT,
  `notes` TEXT,
  `createdAt` TEXT NOT NULL,
  `updatedAt` TEXT NOT NULL
);
CREATE INDEX `Payment_invoiceId_idx` ON `Payment` (`invoiceId`);
CREATE INDEX `Payment_userId_idx` ON `Payment` (`userId`);
CREATE INDEX `Payment_projectId_idx` ON `Payment` (`projectId`);
CREATE INDEX `Payment_paymentDate_idx` ON `Payment` (`paymentDate`);
