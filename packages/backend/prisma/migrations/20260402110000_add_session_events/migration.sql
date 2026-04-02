ALTER TABLE "AgentSession" ADD COLUMN "activeAssistantMessageId" TEXT;

CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "messageId" TEXT,
    "timestampMs" INTEGER NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SessionEvent_sessionId_idx" ON "SessionEvent"("sessionId");
CREATE UNIQUE INDEX "SessionEvent_sessionId_eventId_key" ON "SessionEvent"("sessionId", "eventId");
