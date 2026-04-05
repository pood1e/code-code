import { Injectable } from '@nestjs/common';

import {
  HumanReviewAction,
  HumanReviewReason,
  type ReviewableStageKey
} from '@agent-workbench/shared';

import type { StageExecutionAttemptRecord } from './pipeline.repository';

@Injectable()
export class HumanReviewAssemblerService {
  build(input: {
    reason: HumanReviewReason;
    sourceStageKey: ReviewableStageKey | null;
    sourceAttempt: StageExecutionAttemptRecord | null;
    summary: string;
    candidateOutput?: unknown;
  }) {
    return {
      reason: input.reason,
      sourceStageKey: input.sourceStageKey,
      sourceAttemptId: input.sourceAttempt?.id ?? null,
      summary: input.summary,
      candidateOutput: input.candidateOutput,
      suggestedActions: getSuggestedActions(input.sourceStageKey, input.reason),
      reviewerAction: null,
      reviewerComment: null
    };
  }
}

function getSuggestedActions(
  sourceStageKey: ReviewableStageKey | null,
  reason: HumanReviewReason
) {
  if (reason === HumanReviewReason.ManualEscalation) {
    return [
      HumanReviewAction.EditAndContinue,
      HumanReviewAction.Retry,
      HumanReviewAction.Terminate
    ];
  }

  if (sourceStageKey === 'breakdown') {
    return [HumanReviewAction.Retry, HumanReviewAction.Terminate];
  }

  if (sourceStageKey === 'spec') {
    return [
      HumanReviewAction.EditAndContinue,
      HumanReviewAction.Retry,
      HumanReviewAction.Skip,
      HumanReviewAction.Terminate
    ];
  }

  if (sourceStageKey === 'estimate') {
    return [
      HumanReviewAction.EditAndContinue,
      HumanReviewAction.Retry,
      HumanReviewAction.Terminate
    ];
  }

  return [HumanReviewAction.Retry, HumanReviewAction.Terminate];
}
