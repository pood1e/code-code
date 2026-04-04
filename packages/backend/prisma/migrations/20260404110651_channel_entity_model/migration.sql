/*
  Warnings:

  - You are about to drop the `NotificationSubscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `channel` on the `NotificationTask` table. All the data in the column will be lost.
  - Added the required column `channelId` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scopeId` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "NotificationSubscription_eventType_channel_key";

-- DropIndex
DROP INDEX "idx_subscriptions_event_type";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NotificationSubscription";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "filter" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_NotificationTask" ("createdAt", "eventId", "eventType", "id", "lastError", "payload", "status", "updatedAt") SELECT "createdAt", "eventId", "eventType", "id", "lastError", "payload", "status", "updatedAt" FROM "NotificationTask";
DROP TABLE "NotificationTask";
ALTER TABLE "new_NotificationTask" RENAME TO "NotificationTask";
CREATE INDEX "idx_tasks_status_created_at" ON "NotificationTask"("status", "createdAt");
CREATE INDEX "idx_tasks_status_updated_at" ON "NotificationTask"("status", "updatedAt");
CREATE INDEX "idx_tasks_event_id" ON "NotificationTask"("eventId");
CREATE INDEX "idx_tasks_scope_id" ON "NotificationTask"("scopeId");
CREATE INDEX "idx_tasks_channel_id" ON "NotificationTask"("channelId");
CREATE UNIQUE INDEX "NotificationTask_eventId_channelId_key" ON "NotificationTask"("eventId", "channelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_channel_scope_id" ON "NotificationChannel"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChannel_scopeId_name_key" ON "NotificationChannel"("scopeId", "name");
