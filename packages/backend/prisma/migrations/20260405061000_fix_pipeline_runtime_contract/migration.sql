PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Pipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "runnerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "featureRequest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "currentStageId" TEXT,
    "state" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pipeline_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pipeline_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "AgentRunner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Pipeline" (
    "id",
    "scopeId",
    "name",
    "description",
    "featureRequest",
    "status",
    "currentStageId",
    "state",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "scopeId",
    "name",
    "description",
    "featureRequest",
    "status",
    "currentStageId",
    "state",
    "createdAt",
    "updatedAt"
FROM "Pipeline";

DROP TABLE "Pipeline";
ALTER TABLE "new_Pipeline" RENAME TO "Pipeline";

CREATE INDEX "idx_pipeline_scope_id" ON "Pipeline"("scopeId");
CREATE INDEX "idx_pipeline_status" ON "Pipeline"("status");
CREATE INDEX "idx_pipeline_runner_id" ON "Pipeline"("runnerId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
