import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HumanReviewAction,
  HumanReviewReason,
  StageExecutionAttemptStatus,
  type PipelineHumanReviewPayload
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { HumanReviewPanel } from './HumanReviewPanel';

const mutationsMock = vi.hoisted(() => ({
  useSubmitDecisionMutation: vi.fn()
}));

vi.mock('../hooks/use-pipeline-mutations', () => mutationsMock);

describe('HumanReviewPanel', () => {
  type MutationCallbacks = {
    onSuccess?: () => void;
  };

  type MutationInput =
    | {
        action: HumanReviewAction.Retry;
        comment?: string;
      }
    | {
        action: HumanReviewAction.EditAndContinue;
        comment?: string;
        editedOutput: unknown;
      }
    | {
        action: HumanReviewAction.Skip;
        comment: string;
      }
    | {
        action: HumanReviewAction.Terminate;
        comment: string;
      };

  const mutate = vi.fn<(input: MutationInput, callbacks?: MutationCallbacks) => void>();

  function createReview(
    overrides: Partial<PipelineHumanReviewPayload> = {}
  ): PipelineHumanReviewPayload {
    return {
      reason: HumanReviewReason.ParseFailed,
      sourceStageKey: 'spec',
      sourceAttemptId: 'attempt-1',
      sourceSessionId: 'session-1',
      summary: 'Spec 输出未通过结构化校验。',
      candidateOutput: { taskId: 'task-1', ac: [] },
      suggestedActions: [
        HumanReviewAction.EditAndContinue,
        HumanReviewAction.Retry,
        HumanReviewAction.Skip,
        HumanReviewAction.Terminate
      ],
      reviewerComment: null,
      attempts: [
        {
          id: 'attempt-1',
          stageId: 'stage-1',
          attemptNo: 1,
          status: StageExecutionAttemptStatus.NeedsHumanReview,
          sessionId: 'session-1',
          activeRequestMessageId: 'message-1',
          reviewReason: HumanReviewReason.ParseFailed,
          failureCode: 'PARSE_FAILED',
          failureMessage: 'invalid json',
          startedAt: '2026-04-05T00:00:00.000Z',
          finishedAt: '2026-04-05T00:01:00.000Z',
          createdAt: '2026-04-05T00:00:00.000Z',
          updatedAt: '2026-04-05T00:01:00.000Z'
        }
      ],
      artifacts: [],
      ...overrides
    };
  }

  function getLastMutationCallbacks(): MutationCallbacks | undefined {
    const lastCall = mutate.mock.calls.at(-1) as unknown;
    if (!Array.isArray(lastCall)) {
      return undefined;
    }

    const callbacks: unknown = lastCall[1];
    return callbacks && typeof callbacks === 'object'
      ? (callbacks as MutationCallbacks)
      : undefined;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mutationsMock.useSubmitDecisionMutation.mockReturnValue({
      mutate,
      isPending: false
    });
  });

  it('retry 可直接提交 decision', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HumanReviewPanel
        pipelineId="pipeline-1"
        scopeId="project-1"
        review={createReview({
          suggestedActions: [HumanReviewAction.Retry, HumanReviewAction.Terminate]
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(mutationsMock.useSubmitDecisionMutation).toHaveBeenCalledWith(
      'pipeline-1',
      'project-1'
    );
    expect(mutate).toHaveBeenCalledWith(
      {
        action: HumanReviewAction.Retry,
        comment: undefined
      },
      expect.objectContaining({
        onSuccess: expect.any(Function)
      })
    );
  });

  it('edit_and_continue 会提交结构化输出并在成功后清空 comment', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HumanReviewPanel
        pipelineId="pipeline-1"
        scopeId="project-1"
        review={createReview()}
      />
    );

    await user.clear(screen.getByPlaceholderText('编辑结构化输出 JSON'));
    await user.type(
      screen.getByPlaceholderText(
        '填写 reviewer comment；skip / terminate 必填，retry / edit_and_continue 可选。'
      ),
      '保留原输出，仅补充 reviewer comment'
    );
    fireEvent.change(screen.getByPlaceholderText('编辑结构化输出 JSON'), {
      target: {
        value:
          '{"taskId":"task-1","ac":[{"id":"ac-1","given":"g","when":"w","then":"t"}]}'
      }
    });

    await user.click(screen.getByRole('button', { name: '人工修正并继续' }));

    expect(mutate.mock.calls.at(-1)?.[0]).toEqual({
      action: HumanReviewAction.EditAndContinue,
      comment: '保留原输出，仅补充 reviewer comment',
      editedOutput: {
        taskId: 'task-1',
        ac: [{ id: 'ac-1', given: 'g', when: 'w', then: 't' }]
      }
    });

    const options = getLastMutationCallbacks();
    act(() => {
      options?.onSuccess?.();
    });
    expect(
      screen.getByPlaceholderText(
        '填写 reviewer comment；skip / terminate 必填，retry / edit_and_continue 可选。'
      )
    ).toHaveValue('');
  });

  it('skip 和 terminate 在没有 comment 时禁用，填写后提交对应 action', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HumanReviewPanel
        pipelineId="pipeline-1"
        scopeId="project-1"
        review={createReview()}
      />
    );

    const skipButton = screen.getByRole('button', { name: '跳过' });
    const terminateButton = screen.getByRole('button', { name: '终止' });

    expect(skipButton).toBeDisabled();
    expect(terminateButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(
        '填写 reviewer comment；skip / terminate 必填，retry / edit_and_continue 可选。'
      ),
      '当前阶段不再继续'
    );

    expect(skipButton).toBeEnabled();
    expect(terminateButton).toBeEnabled();

    await user.click(skipButton);
    expect(mutate.mock.calls.at(-1)?.[0]).toEqual({
      action: HumanReviewAction.Skip,
      comment: '当前阶段不再继续'
    });

    const skipOptions = getLastMutationCallbacks();
    act(() => {
      skipOptions?.onSuccess?.();
    });

    await user.type(
      screen.getByPlaceholderText(
        '填写 reviewer comment；skip / terminate 必填，retry / edit_and_continue 可选。'
      ),
      '人工终止'
    );
    await user.click(terminateButton);

    expect(mutate.mock.calls.at(-1)?.[0]).toEqual({
      action: HumanReviewAction.Terminate,
      comment: '人工终止'
    });
  });
});
