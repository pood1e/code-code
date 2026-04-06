ALTER TABLE "PipelineArtifact" ADD COLUMN "artifactKey" TEXT NOT NULL DEFAULT 'prd';
ALTER TABLE "PipelineArtifact" ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PipelineArtifact" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "PipelineArtifact"
SET
  "artifactKey" = CASE
    WHEN "name" = 'prd.json' THEN 'prd'
    WHEN "name" = 'ac-spec.json' THEN 'ac_spec'
    WHEN "name" = 'plan-report.md' THEN 'plan_report'
    ELSE 'prd'
  END,
  "metadata" = json_set(
    COALESCE("metadata", '{}'),
    '$.artifactKey',
    CASE
      WHEN "name" = 'prd.json' THEN 'prd'
      WHEN "name" = 'ac-spec.json' THEN 'ac_spec'
      WHEN "name" = 'plan-report.md' THEN 'plan_report'
      ELSE 'prd'
    END,
    '$.attempt',
    1,
    '$.version',
    1
  );

CREATE INDEX "idx_pipeline_artifact_version"
ON "PipelineArtifact"("pipelineId", "artifactKey", "version");

ALTER TABLE "PipelineEvent" ADD COLUMN "stageType" TEXT;
