ALTER TABLE "Pipeline"
ADD COLUMN "executionOwnerId" TEXT;

ALTER TABLE "Pipeline"
ADD COLUMN "executionLeaseExpiresAt" DATETIME;

ALTER TABLE "PipelineArtifact"
ADD COLUMN "materializerOwnerId" TEXT;

ALTER TABLE "PipelineArtifact"
ADD COLUMN "materializerLeaseExpiresAt" DATETIME;

CREATE INDEX "idx_pipeline_execution_lease"
ON "Pipeline"("status", "executionLeaseExpiresAt");

CREATE INDEX "idx_pipeline_artifact_materializer_lease"
ON "PipelineArtifact"("status", "materializerLeaseExpiresAt");
