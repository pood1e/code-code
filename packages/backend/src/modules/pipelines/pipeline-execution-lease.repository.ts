import type { PipelineArtifactRecord } from './pipeline.repository';
import type { ClaimedPipelineRecord } from './pipeline-runtime.repository';

export abstract class PipelineExecutionLeaseRepository {
  abstract claimPipelineExecution(input: {
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<ClaimedPipelineRecord | null>;

  abstract renewPipelineExecutionLease(input: {
    pipelineId: string;
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean>;

  abstract claimArtifactMaterialization(input: {
    ownerId: string;
    now: Date;
    retryBefore: Date;
    leaseExpiresAt: Date;
  }): Promise<PipelineArtifactRecord | null>;

  abstract renewArtifactMaterializationLease(input: {
    artifactId: string;
    ownerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<boolean>;
}
