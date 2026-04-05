import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PipelineArtifactKey } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { ArtifactList } from './ArtifactList';

describe('ArtifactList', () => {
  it('应展示 artifact 版本信息', () => {
    renderWithProviders(
      <ArtifactList
        pipelineId="pipeline-1"
        artifacts={[
          {
            id: 'artifact-1',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            name: 'ac-spec.json',
            contentType: 'application/json',
            storageRef: 'fs:///tmp/ac-spec.json',
            metadata: {
              artifactKey: PipelineArtifactKey.AcSpec,
              attempt: 2,
              version: 3
            },
            createdAt: '2026-04-05T00:00:00.000Z'
          }
        ]}
      />
    );

    expect(screen.getByText('ac-spec.json')).toBeInTheDocument();
    expect(screen.getByText('A2 · v3')).toBeInTheDocument();
  });
});
