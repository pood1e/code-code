-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN "resumePayload" TEXT;

-- CreateTable
CREATE TABLE "PipelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "stageId" TEXT,
    "timestampMs" BIGINT NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineEvent_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "idx_pipeline_event_pipeline_id" ON "PipelineEvent"("pipelineId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineEvent_pipelineId_eventId_key" ON "PipelineEvent"("pipelineId", "eventId");

-- CreateIndex
CREATE INDEX "idx_pipeline_status" ON "Pipeline"("status");
