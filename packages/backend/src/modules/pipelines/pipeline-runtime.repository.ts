import type {
  PipelineArtifactKey,
  PipelineConfig,
  PipelineEvent,
  PipelineStageStatus,
  PipelineStageType,
  PipelineStatus
} from '@agent-workbench/shared';

import type {
  PipelineRecord,
  PipelineStageRecord
} from './pipeline.repository';
import type { PipelineRuntimeState } from './pipeline-runtime-state';

export type ClaimedPipelineRecord = {
  id: string;
  featureRequest: string | null;
  state: unknown;
};

export type PipelineDecisionContext = {
  pipeline: PipelineRecord;
  stages: PipelineStageRecord[];
};

export type PipelineRuntimeMutationResult<T> = {
  value: T;
  events: PipelineEvent[];
  shouldCloseStream?: boolean;
};

export type ManagedArtifactIntent = {
  stageId?: string | null;
  artifactKey: PipelineArtifactKey;
  attempt: number;
  version: number;
  name: string;
  contentType: string;
  content: string;
};

export abstract class PipelineRuntimeRepository {
  abstract recoverInterruptedPipelines(): Promise<number>;
  abstract startDraftPipeline(input: {
    pipelineId: string;
    runnerId: string;
    config: PipelineConfig;
    runtimeState: PipelineRuntimeState;
    stageDefinitions: Array<{
      stageType: PipelineStageType;
      name: string;
      order: number;
      status: PipelineStageStatus;
    }>;
  }): Promise<PipelineRuntimeMutationResult<PipelineRecord> | null>;
  abstract getDecisionContext(id: string): Promise<PipelineDecisionContext | null>;
  abstract startStage(
    pipelineId: string,
    ownerId: string,
    stageType: PipelineStageType
  ): Promise<PipelineRuntimeMutationResult<PipelineStageRecord> | null>;
  abstract completeStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    nextState: PipelineRuntimeState;
    retryCount?: number;
    artifactIntents?: ManagedArtifactIntent[];
  }): Promise<PipelineRuntimeMutationResult<boolean> | null>;
  abstract failStage(input: {
    pipelineId: string;
    ownerId: string;
    stageId: string;
    stageType: PipelineStageType;
    reason: string;
    retryCount?: number;
    nextState?: PipelineRuntimeState;
  }): Promise<PipelineRuntimeMutationResult<boolean> | null>;
  abstract pauseForHumanReview(
    pipelineId: string,
    ownerId: string,
    runtimeState: PipelineRuntimeState
  ): Promise<PipelineRuntimeMutationResult<boolean> | null>;
  abstract completeExecution(
    pipelineId: string,
    ownerId: string
  ): Promise<PipelineRuntimeMutationResult<PipelineRecord> | null>;
  abstract failExecution(
    pipelineId: string,
    ownerId: string,
    reason: string
  ): Promise<PipelineRuntimeMutationResult<PipelineRecord> | null>;
  abstract cancelPipeline(
    pipelineId: string
  ): Promise<PipelineRuntimeMutationResult<PipelineRecord> | null>;
  abstract resumeFromHumanReview(input: {
    pipelineId: string;
    nextState: PipelineRuntimeState;
    stageStatusOverrides: Array<{
      stageType: PipelineStageType;
      status: PipelineStageStatus;
    }>;
  }): Promise<PipelineRuntimeMutationResult<boolean> | null>;
}
