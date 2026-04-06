import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HumanReviewReason,
  PipelineStageStatus,
  PipelineStageType,
  StageExecutionAttemptStatus
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { PipelineStageTimeline } from './PipelineStageTimeline';

describe('PipelineStageTimeline', () => {
  it('取消中的 stage 应展示 stage 状态和 attempts', () => {
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
            attemptCount: 1,
            latestFailureReason: '人工取消',
            attempts: [
              {
                id: 'attempt-1',
                stageId: 'stage-1',
                attemptNo: 1,
                status: StageExecutionAttemptStatus.Cancelled,
                sessionId: 'session-1',
                activeRequestMessageId: 'message-1',
                reviewReason: HumanReviewReason.ManualEscalation,
                failureCode: null,
                failureMessage: '人工取消',
                startedAt: '2026-04-05T00:00:00.000Z',
                finishedAt: '2026-04-05T00:00:00.000Z',
                createdAt: '2026-04-05T00:00:00.000Z',
                updatedAt: '2026-04-05T00:00:00.000Z'
              }
            ],
            createdAt: '2026-04-05T00:00:00.000Z',
            updatedAt: '2026-04-05T00:00:00.000Z'
          }
        ]}
      />
    );

    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.getByText('已取消')).toBeInTheDocument();
    expect(screen.getByText('Attempts: 1')).toBeInTheDocument();
    expect(screen.getByText('尝试 1: 已取消')).toBeInTheDocument();
    expect(screen.getByText('Session: session-1')).toBeInTheDocument();
  });
});
