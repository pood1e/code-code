import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';

import {
  ARTIFACT_STORAGE,
  type ArtifactStorage
} from './artifact-storage/artifact-storage.interface';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';

const RETRY_BACKOFF_MS = 5_000;

@Injectable()
export class PipelineArtifactMaterializerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PipelineArtifactMaterializerService.name);
  private isRunning = false;

  constructor(
    private readonly pipelineArtifactRepository: PipelineArtifactRepository,
    @Inject(ARTIFACT_STORAGE)
    private readonly artifactStorage: ArtifactStorage
  ) {}

  onApplicationBootstrap(): void {
    this.isRunning = true;
    void this.recoverInterruptedArtifacts();
    void this.pollLoop();
  }

  onApplicationShutdown(): void {
    this.isRunning = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      const artifact =
        await this.pipelineArtifactRepository.claimNextArtifactToMaterialize(
          new Date(Date.now() - RETRY_BACKOFF_MS)
        );

      if (!artifact) {
        await sleep(1000);
        continue;
      }

      if (!artifact.content) {
        await this.pipelineArtifactRepository.markArtifactFailed(
          artifact.id,
          'Artifact content is missing'
        );
        continue;
      }

      try {
        const storageRef = await this.artifactStorage.write(
          artifact.pipelineId,
          artifact.name,
          artifact.content,
          artifact.contentType
        );
        await this.pipelineArtifactRepository.markArtifactReady(
          artifact.id,
          storageRef
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Artifact ${artifact.id} materialization failed: ${reason}`
        );
        await this.pipelineArtifactRepository.markArtifactFailed(
          artifact.id,
          reason
        );
      }
    }
  }

  private async recoverInterruptedArtifacts(): Promise<void> {
    const recovered =
      await this.pipelineArtifactRepository.recoverProcessingArtifacts();
    if (recovered > 0) {
      this.logger.warn(
        `Recovered ${recovered} pipeline artifact(s) from 'processing' -> 'pending'`
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
