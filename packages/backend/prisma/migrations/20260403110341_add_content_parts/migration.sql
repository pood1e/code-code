-- AlterTable
ALTER TABLE "SessionMessage" ADD COLUMN "contentParts" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runnerId" TEXT NOT NULL,
    "runnerType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "activeAssistantMessageId" TEXT,
    "platformSessionConfig" JSONB NOT NULL,
    "runnerSessionConfig" JSONB NOT NULL,
    "defaultRuntimeConfig" JSONB,
    "runnerState" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentSession_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "AgentRunner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentSession_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentSession" ("activeAssistantMessageId", "createdAt", "id", "lastEventId", "platformSessionConfig", "runnerId", "runnerSessionConfig", "runnerState", "runnerType", "scopeId", "status", "updatedAt") SELECT "activeAssistantMessageId", "createdAt", "id", "lastEventId", "platformSessionConfig", "runnerId", "runnerSessionConfig", "runnerState", "runnerType", "scopeId", "status", "updatedAt" FROM "AgentSession";
DROP TABLE "AgentSession";
ALTER TABLE "new_AgentSession" RENAME TO "AgentSession";
CREATE INDEX "AgentSession_scopeId_idx" ON "AgentSession"("scopeId");
CREATE TABLE "new_MessageToolUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "callId" TEXT,
    "toolName" TEXT NOT NULL,
    "args" JSONB,
    "result" JSONB,
    "error" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageToolUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageToolUse_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SessionMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageToolUse" ("args", "callId", "createdAt", "error", "eventId", "id", "messageId", "result", "sessionId", "toolName") SELECT "args", "callId", "createdAt", "error", "eventId", "id", "messageId", "result", "sessionId", "toolName" FROM "MessageToolUse";
DROP TABLE "MessageToolUse";
ALTER TABLE "new_MessageToolUse" RENAME TO "MessageToolUse";
CREATE INDEX "MessageToolUse_sessionId_idx" ON "MessageToolUse"("sessionId");
CREATE INDEX "MessageToolUse_messageId_idx" ON "MessageToolUse"("messageId");
CREATE UNIQUE INDEX "MessageToolUse_sessionId_eventId_key" ON "MessageToolUse"("sessionId", "eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
