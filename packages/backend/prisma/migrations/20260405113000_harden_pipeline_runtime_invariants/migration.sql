PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "PipelineArtifactSeries" (
    "pipelineId" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "nextVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineArtifactSeries_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("pipelineId", "artifactKey")
);

CREATE INDEX "idx_pipeline_artifact_series_pipeline_id"
ON "PipelineArtifactSeries"("pipelineId");

CREATE TABLE "new_PipelineArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT,
    "artifactKey" TEXT,
    "attempt" INTEGER,
    "version" INTEGER,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageRef" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineArtifact_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineArtifact_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

WITH ranked AS (
  SELECT
    "id",
    CASE
      WHEN "name" = 'prd.json' THEN 'prd'
      WHEN "name" = 'ac-spec.json' THEN 'ac_spec'
      WHEN "name" = 'plan-report.md' THEN 'plan_report'
      ELSE NULL
    END AS "computedKey",
    CASE
      WHEN "name" IN ('prd.json', 'ac-spec.json', 'plan-report.md') THEN
        ROW_NUMBER() OVER (
          PARTITION BY
            "pipelineId",
            CASE
              WHEN "name" = 'prd.json' THEN 'prd'
              WHEN "name" = 'ac-spec.json' THEN 'ac_spec'
              WHEN "name" = 'plan-report.md' THEN 'plan_report'
            END
          ORDER BY "createdAt" ASC, "id" ASC
        )
      ELSE NULL
    END AS "computedVersion"
  FROM "PipelineArtifact"
)
INSERT INTO "new_PipelineArtifact" (
  "id",
  "pipelineId",
  "stageId",
  "artifactKey",
  "attempt",
  "version",
  "name",
  "contentType",
  "storageRef",
  "metadata",
  "createdAt"
)
SELECT
  artifact."id",
  artifact."pipelineId",
  artifact."stageId",
  ranked."computedKey",
  ranked."computedVersion",
  ranked."computedVersion",
  artifact."name",
  artifact."contentType",
  artifact."storageRef",
  artifact."metadata",
  artifact."createdAt"
FROM "PipelineArtifact" AS artifact
JOIN ranked ON ranked."id" = artifact."id";

DROP TABLE "PipelineArtifact";
ALTER TABLE "new_PipelineArtifact" RENAME TO "PipelineArtifact";

CREATE INDEX "idx_pipeline_artifact_pipeline_id"
ON "PipelineArtifact"("pipelineId");

CREATE INDEX "idx_pipeline_artifact_stage_id"
ON "PipelineArtifact"("stageId");

CREATE UNIQUE INDEX "uq_pipeline_artifact_version"
ON "PipelineArtifact"("pipelineId", "artifactKey", "version");

INSERT INTO "PipelineArtifactSeries" (
  "pipelineId",
  "artifactKey",
  "nextVersion",
  "createdAt",
  "updatedAt"
)
SELECT
  "pipelineId",
  "artifactKey",
  MAX("version") + 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PipelineArtifact"
WHERE "artifactKey" IS NOT NULL AND "version" IS NOT NULL
GROUP BY "pipelineId", "artifactKey";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
