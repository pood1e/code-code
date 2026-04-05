import type {
  ArtifactContentType,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import type { PipelineArtifactStatus } from './pipeline-artifact.constants';

export type PipelineRecord = {
  id: string;
  scopeId: string;
  runnerId: string | null;
  name: string;
  description: string | null;
  featureRequest: string | null;
  status: PipelineStatus;
  currentStageId: string | null;
  executionOwnerId: string | null;
  executionLeaseExpiresAt: Date | null;
  state: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineStageRecord = {
  id: string;
  pipelineId: string;
  name: string;
  stageType: PipelineStageType;
  order: number;
  status: PipelineStageStatus;
  retryCount: number;
  sessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineArtifactRecord = {
  id: string;
  pipelineId: string;
  stageId: string | null;
  artifactKey: string | null;
  attempt: number | null;
  version: number | null;
  status: PipelineArtifactStatus;
  materializerOwnerId: string | null;
  materializerLeaseExpiresAt: Date | null;
  name: string;
  contentType: ArtifactContentType;
  storageRef: string | null;
  content: string | null;
  lastError: string | null;
  materializeAttempts: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PipelineDetailRecord = PipelineRecord & {
  stages: PipelineStageRecord[];
  artifacts: PipelineArtifactRecord[];
};

export abstract class PipelineRepository {
  abstract projectExists(scopeId: string): Promise<boolean>;
  abstract runnerExists(runnerId: string): Promise<boolean>;
  abstract createPipeline(input: {
    scopeId: string;
    name: string;
    description?: string | null;
    featureRequest?: string | null;
  }): Promise<PipelineRecord>;
  abstract findPipelineById(id: string): Promise<PipelineRecord | null>;
  abstract updatePipeline(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      featureRequest?: string | null;
    }
  ): Promise<PipelineRecord>;
  abstract deletePipeline(id: string): Promise<void>;
  abstract listPipelines(
    scopeId?: string,
    status?: PipelineStatus
  ): Promise<PipelineRecord[]>;
  abstract getPipelineDetail(id: string): Promise<PipelineDetailRecord | null>;
  abstract getPipelineStages(id: string): Promise<PipelineStageRecord[]>;
  abstract getReadyArtifactsByPipelineId(
    pipelineId: string
  ): Promise<PipelineArtifactRecord[]>;
}
