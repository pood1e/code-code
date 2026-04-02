CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runnerId" TEXT NOT NULL,
    "runnerType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "platformSessionConfig" JSONB NOT NULL,
    "runnerSessionConfig" JSONB NOT NULL,
    "runnerState" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentSession_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentSession_scopeId_idx" ON "AgentSession"("scopeId");

CREATE TABLE "SessionMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputContent" JSONB,
    "outputText" TEXT,
    "thinkingText" TEXT,
    "errorPayload" JSONB,
    "cancelledAt" DATETIME,
    "eventId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SessionMessage_sessionId_idx" ON "SessionMessage"("sessionId");
CREATE UNIQUE INDEX "SessionMessage_sessionId_eventId_key" ON "SessionMessage"("sessionId", "eventId");

CREATE TABLE "MessageToolUse" (
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
    CONSTRAINT "MessageToolUse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MessageToolUse_sessionId_idx" ON "MessageToolUse"("sessionId");
CREATE INDEX "MessageToolUse_messageId_idx" ON "MessageToolUse"("messageId");
CREATE UNIQUE INDEX "MessageToolUse_sessionId_eventId_key" ON "MessageToolUse"("sessionId", "eventId");

CREATE TABLE "SessionMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "eventId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionMetric_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionMetric_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SessionMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SessionMetric_sessionId_idx" ON "SessionMetric"("sessionId");
CREATE INDEX "SessionMetric_sessionId_messageId_idx" ON "SessionMetric"("sessionId", "messageId");
CREATE UNIQUE INDEX "SessionMetric_sessionId_eventId_key" ON "SessionMetric"("sessionId", "eventId");
