PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PipelineArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT,
    "artifactKey" TEXT,
    "attempt" INTEGER,
    "version" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageRef" TEXT,
    "content" TEXT,
    "lastError" TEXT,
    "materializeAttempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineArtifact_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineArtifact_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_PipelineArtifact" (
  "id",
  "pipelineId",
  "stageId",
  "artifactKey",
  "attempt",
  "version",
  "status",
  "name",
  "contentType",
  "storageRef",
  "content",
  "lastError",
  "materializeAttempts",
  "metadata",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "pipelineId",
  "stageId",
  "artifactKey",
  "attempt",
  "version",
  'ready',
  "name",
  "contentType",
  "storageRef",
  NULL,
  NULL,
  0,
  "metadata",
  "createdAt",
  "createdAt"
FROM "PipelineArtifact";

DROP TABLE "PipelineArtifact";
ALTER TABLE "new_PipelineArtifact" RENAME TO "PipelineArtifact";

CREATE INDEX "idx_pipeline_artifact_pipeline_id"
ON "PipelineArtifact"("pipelineId");

CREATE INDEX "idx_pipeline_artifact_stage_id"
ON "PipelineArtifact"("stageId");

CREATE INDEX "idx_pipeline_artifact_status_updated_at"
ON "PipelineArtifact"("status", "updatedAt");

CREATE UNIQUE INDEX "uq_pipeline_artifact_version"
ON "PipelineArtifact"("pipelineId", "artifactKey", "version");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
