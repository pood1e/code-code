import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  PipelineStageStatus,
  PipelineStageType
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { PipelineStageTimeline } from './PipelineStageTimeline';

describe('PipelineStageTimeline', () => {
  it('取消中的 stage 应展示为已取消', () => {
    renderWithProviders(
      <PipelineStageTimeline
        stages={[
          {
            id: 'stage-1',
            pipelineId: 'pipeline-1',
            name: 'Estimate',
            stageType: PipelineStageType.Estimate,
            order: 3,
            status: PipelineStageStatus.Cancelled,
            retryCount: 0,
            sessionId: null,
            createdAt: '2026-04-05T00:00:00.000Z',
            updatedAt: '2026-04-05T00:00:00.000Z'
          }
        ]}
      />
    );

    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
  });
});
