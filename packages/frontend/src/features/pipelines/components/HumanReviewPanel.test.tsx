import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HumanDecisionAction } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { HumanReviewPanel } from './HumanReviewPanel';

const mutationsMock = vi.hoisted(() => ({
  useSubmitDecisionMutation: vi.fn()
}));

vi.mock('../hooks/use-pipeline-mutations', () => mutationsMock);

describe('HumanReviewPanel', () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutationsMock.useSubmitDecisionMutation.mockReturnValue({
      mutate,
      isPending: false
    });
  });

  it('批准时可直接提交 decision', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HumanReviewPanel pipelineId="pipeline-1" scopeId="project-1" />
    );

    await user.click(screen.getByRole('button', { name: '批准' }));

    expect(mutationsMock.useSubmitDecisionMutation).toHaveBeenCalledWith(
      'pipeline-1',
      'project-1'
    );
    expect(mutate).toHaveBeenCalledWith({
      action: HumanDecisionAction.Approve
    });
  });

  it('修改和拒绝在没有反馈时应禁用，填写反馈后提交对应 action', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HumanReviewPanel pipelineId="pipeline-1" scopeId="project-1" />
    );

    const modifyButton = screen.getByRole('button', { name: '修改' });
    const rejectButton = screen.getByRole('button', { name: '拒绝' });

    expect(modifyButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(
        '修改或拒绝时请填写意见，例如：补充边界条件、重写 AC、重新分解任务...'
      ),
      '补充失败路径'
    );

    expect(modifyButton).toBeEnabled();
    expect(rejectButton).toBeEnabled();

    await user.click(modifyButton);
    expect(mutate).toHaveBeenCalledWith({
      action: HumanDecisionAction.Modify,
      feedback: '补充失败路径'
    });

    await user.type(
      screen.getByPlaceholderText(
        '修改或拒绝时请填写意见，例如：补充边界条件、重写 AC、重新分解任务...'
      ),
      '重新拆分任务'
    );
    await user.click(rejectButton);

    expect(mutate).toHaveBeenCalledWith({
      action: HumanDecisionAction.Reject,
      feedback: '重新拆分任务'
    });
  });
});
