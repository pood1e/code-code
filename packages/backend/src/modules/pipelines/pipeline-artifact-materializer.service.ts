import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import {
  ARTIFACT_STORAGE,
  type ArtifactStorage
} from './artifact-storage/artifact-storage.interface';
import { LeaseHeartbeatRunner } from './lease-heartbeat-runner.service';
import { PipelineArtifactRepository } from './pipeline-artifact.repository';
import { PipelineExecutionLeaseRepository } from './pipeline-execution-lease.repository';

const RETRY_BACKOFF_MS = 5_000;
const MATERIALIZER_LEASE_MS = 30_000;
const MATERIALIZER_LEASE_RENEW_INTERVAL_MS = 10_000;

@Injectable()
export class PipelineArtifactMaterializerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PipelineArtifactMaterializerService.name);
  private readonly ownerId = `artifact-materializer:${randomUUID()}`;
  private isRunning = false;

  constructor(
    private readonly pipelineExecutionLeaseRepository: PipelineExecutionLeaseRepository,
    private readonly pipelineArtifactRepository: PipelineArtifactRepository,
    private readonly leaseHeartbeatRunner: LeaseHeartbeatRunner,
    @Inject(ARTIFACT_STORAGE)
    private readonly artifactStorage: ArtifactStorage
  ) {}

  onApplicationBootstrap(): void {
    this.isRunning = true;
    void this.pollLoop();
  }

  onApplicationShutdown(): void {
    this.isRunning = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      const artifact =
        await this.pipelineExecutionLeaseRepository.claimArtifactMaterialization({
          ownerId: this.ownerId,
          retryBefore: new Date(Date.now() - RETRY_BACKOFF_MS),
          ...this.createLeaseWindow()
        });

      if (!artifact) {
        await sleep(1000);
        continue;
      }

      const heartbeat = this.leaseHeartbeatRunner.start({
        intervalMs: MATERIALIZER_LEASE_RENEW_INTERVAL_MS,
        renew: () =>
          this.pipelineExecutionLeaseRepository.renewArtifactMaterializationLease({
            artifactId: artifact.id,
            ownerId: this.ownerId,
            ...this.createLeaseWindow()
          })
      });

      if (!artifact.content) {
        try {
          await this.pipelineArtifactRepository.markArtifactFailed(
            artifact.id,
            this.ownerId,
            'Artifact content is missing'
          );
        } finally {
          await heartbeat.stop();
        }
        continue;
      }

      try {
        if (!heartbeat.hasLease()) {
          continue;
        }

        const storageRef = await this.artifactStorage.write(
          artifact.pipelineId,
          `${artifact.id}-${artifact.name}`,
          artifact.content,
          artifact.contentType
        );
        if (!heartbeat.hasLease()) {
          continue;
        }
        await this.pipelineArtifactRepository.markArtifactReady(
          artifact.id,
          this.ownerId,
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
          this.ownerId,
          reason
        );
      } finally {
        await heartbeat.stop();
      }
    }
  }

  private createLeaseWindow() {
    const now = new Date();
    return {
      now,
      leaseExpiresAt: new Date(now.getTime() + MATERIALIZER_LEASE_MS)
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
