/*
  Warnings:

  - You are about to drop the column `channelType` on the `NotificationChannel` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `NotificationTask` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `NotificationTask` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `NotificationTask` table. All the data in the column will be lost.
  - Added the required column `capabilityId` to the `NotificationChannel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `channelName` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageId` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageType` to the `NotificationTask` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chat_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featureRequest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStageId" TEXT,
    "state" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pipeline_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stageType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineStage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineArtifact_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineArtifact_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "filter" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationChannel_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NotificationChannel" ("config", "createdAt", "enabled", "filter", "id", "name", "scopeId", "updatedAt") SELECT "config", "createdAt", "enabled", "filter", "id", "name", "scopeId", "updatedAt" FROM "NotificationChannel";
DROP TABLE "NotificationChannel";
ALTER TABLE "new_NotificationChannel" RENAME TO "NotificationChannel";
CREATE INDEX "idx_channel_scope_id" ON "NotificationChannel"("scopeId");
CREATE UNIQUE INDEX "NotificationChannel_scopeId_name_key" ON "NotificationChannel"("scopeId", "name");
CREATE TABLE "new_NotificationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "channelId" TEXT,
    "channelName" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationTask_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationTask_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "NotificationChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NotificationTask" ("channelId", "createdAt", "id", "lastError", "scopeId", "status", "updatedAt") SELECT "channelId", "createdAt", "id", "lastError", "scopeId", "status", "updatedAt" FROM "NotificationTask";
DROP TABLE "NotificationTask";
ALTER TABLE "new_NotificationTask" RENAME TO "NotificationTask";
CREATE INDEX "idx_tasks_status_created_at" ON "NotificationTask"("status", "createdAt");
CREATE INDEX "idx_tasks_status_updated_at" ON "NotificationTask"("status", "updatedAt");
CREATE INDEX "idx_tasks_message_id" ON "NotificationTask"("messageId");
CREATE INDEX "idx_tasks_scope_id" ON "NotificationTask"("scopeId");
CREATE INDEX "idx_tasks_channel_id" ON "NotificationTask"("channelId");
CREATE UNIQUE INDEX "NotificationTask_messageId_channelId_key" ON "NotificationTask"("messageId", "channelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_sessionId_key" ON "Chat"("sessionId");

-- CreateIndex
CREATE INDEX "idx_chat_scope_id" ON "Chat"("scopeId");

-- CreateIndex
CREATE INDEX "idx_pipeline_scope_id" ON "Pipeline"("scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_sessionId_key" ON "PipelineStage"("sessionId");

-- CreateIndex
CREATE INDEX "idx_pipeline_stage_pipeline_id" ON "PipelineStage"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_order_key" ON "PipelineStage"("pipelineId", "order");

-- CreateIndex
CREATE INDEX "idx_pipeline_artifact_pipeline_id" ON "PipelineArtifact"("pipelineId");

-- CreateIndex
CREATE INDEX "idx_pipeline_artifact_stage_id" ON "PipelineArtifact"("stageId");
