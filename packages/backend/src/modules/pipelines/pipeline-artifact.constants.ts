export const PIPELINE_ARTIFACT_STATUS = {
  Pending: 'pending',
  Processing: 'processing',
  Ready: 'ready',
  Failed: 'failed'
} as const;

export type PipelineArtifactStatus =
  (typeof PIPELINE_ARTIFACT_STATUS)[keyof typeof PIPELINE_ARTIFACT_STATUS];
