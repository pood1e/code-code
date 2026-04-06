import type { PipelineArtifactKey } from '@agent-workbench/shared';

export abstract class PipelineArtifactVersionRepository {
  abstract reserveNextVersion(
    pipelineId: string,
    artifactKey: PipelineArtifactKey
  ): Promise<number>;
}
