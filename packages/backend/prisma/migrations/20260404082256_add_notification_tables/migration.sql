-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_subscriptions_event_type" ON "NotificationSubscription"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_eventType_channel_key" ON "NotificationSubscription"("eventType", "channel");

-- CreateIndex
CREATE INDEX "idx_tasks_status_created_at" ON "NotificationTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_tasks_status_updated_at" ON "NotificationTask"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_tasks_event_id" ON "NotificationTask"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTask_eventId_channel_key" ON "NotificationTask"("eventId", "channel");
