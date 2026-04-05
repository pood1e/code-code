import type {
  ArtifactContentType,
  PipelineArtifactKey
} from '@agent-workbench/shared';

import type { PipelineArtifactRecord } from './pipeline.repository';

export type CreatePipelineArtifactIntentInput = {
  pipelineId: string;
  stageId?: string | null;
  artifactKey?: PipelineArtifactKey | null;
  attempt?: number | null;
  name: string;
  contentType: ArtifactContentType;
  content: string;
  metadata?: Record<string, unknown> | null;
};

export abstract class PipelineArtifactRepository {
  abstract createArtifactIntent(
    input: CreatePipelineArtifactIntentInput
  ): Promise<PipelineArtifactRecord>;
  abstract createManagedArtifactIntent(input: {
    pipelineId: string;
    stageId?: string | null;
    artifactKey: PipelineArtifactKey;
    attempt: number;
    name: string;
    contentType: ArtifactContentType;
    content: string;
  }): Promise<PipelineArtifactRecord>;
  abstract findArtifactById(id: string): Promise<PipelineArtifactRecord | null>;
  abstract listArtifactStorageRefsByPipelineId(
    pipelineId: string
  ): Promise<string[]>;
  abstract claimNextArtifactToMaterialize(
    retryBefore: Date
  ): Promise<PipelineArtifactRecord | null>;
  abstract markArtifactReady(
    artifactId: string,
    storageRef: string
  ): Promise<boolean>;
  abstract markArtifactFailed(
    artifactId: string,
    reason: string
  ): Promise<boolean>;
  abstract recoverProcessingArtifacts(): Promise<number>;
}
