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
  abstract listManagedArtifactsForAttempt(input: {
    pipelineId: string;
    attempt: number;
    artifactKeys: readonly PipelineArtifactKey[];
  }): Promise<PipelineArtifactRecord[]>;
  abstract markArtifactReady(
    artifactId: string,
    ownerId: string,
    storageRef: string
  ): Promise<boolean>;
  abstract markArtifactFailed(
    artifactId: string,
    ownerId: string,
    reason: string
  ): Promise<boolean>;
}
