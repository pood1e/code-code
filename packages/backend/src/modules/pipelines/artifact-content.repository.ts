import type { PipelineArtifactRecord } from './pipeline.repository';

export abstract class ArtifactContentRepository {
  abstract readArtifactContent(artifact: PipelineArtifactRecord): Promise<Buffer>;
}
