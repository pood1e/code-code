import { Inject, Injectable, ConflictException } from '@nestjs/common';

import { ARTIFACT_STORAGE, type ArtifactStorage } from './artifact-storage/artifact-storage.interface';
import { ArtifactContentRepository } from './artifact-content.repository';
import type { PipelineArtifactRecord } from './pipeline.repository';

@Injectable()
export class DefaultArtifactContentRepository extends ArtifactContentRepository {
  constructor(
    @Inject(ARTIFACT_STORAGE)
    private readonly artifactStorage: ArtifactStorage
  ) {
    super();
  }

  async readArtifactContent(artifact: PipelineArtifactRecord): Promise<Buffer> {
    if (artifact.content !== null) {
      return Buffer.from(artifact.content, 'utf8');
    }

    if (!artifact.storageRef) {
      throw new ConflictException(
        `Artifact content is not materialized yet: ${artifact.id}`
      );
    }

    return this.artifactStorage.read(artifact.storageRef);
  }
}
