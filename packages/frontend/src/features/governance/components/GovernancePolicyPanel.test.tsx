import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AgentRunnerSummary,
  GovernanceAutoActionEligibility,
  GovernanceDeliveryCommitMode,
  GovernancePriority,
  GovernanceSeverity,
  type GovernancePolicy
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { GovernancePolicyPanel } from './GovernancePolicyPanel';

const onSubmit = vi.fn();

function createRunners(): AgentRunnerSummary[] {
  return [
    {
      id: 'runner-1',
      name: 'MiniMax 2.7 Runner',
      description: '用于治理分析',
      type: 'openai-responses',
      createdAt: '2026-04-06T10:00:00.000Z',
      updatedAt: '2026-04-06T10:00:00.000Z'
    },
    {
      id: 'runner-2',
      name: 'Execution Runner',
      description: '用于执行',
      type: 'mock',
      createdAt: '2026-04-06T10:00:00.000Z',
      updatedAt: '2026-04-06T10:00:00.000Z'
    }
  ];
}

function createPolicy(): GovernancePolicy {
  return {
    id: 'policy-1',
    scopeId: 'project-1',
    priorityPolicy: {
      defaultPriority: GovernancePriority.P2,
      severityOverrides: {
        [GovernanceSeverity.Critical]: GovernancePriority.P0
      }
    },
    autoActionPolicy: {
      defaultEligibility: GovernanceAutoActionEligibility.HumanReviewRequired,
      severityOverrides: {
        [GovernanceSeverity.High]:
          GovernanceAutoActionEligibility.HumanReviewRequired
      },
      issueKindOverrides: {
        improvement: GovernanceAutoActionEligibility.SuggestOnly
      }
    },
    deliveryPolicy: {
      commitMode: GovernanceDeliveryCommitMode.PerUnit,
      autoCloseIssueOnApprovedDelivery: true
    },
    runnerSelection: {
      defaultRunnerId: null,
      discoveryRunnerId: null,
      triageRunnerId: null,
      planningRunnerId: null,
      executionRunnerId: null
    },
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z'
  };
}

describe('GovernancePolicyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应展示 policy 并提交更新后的 JSON', async () => {
    const { user } = renderWithProviders(
      <GovernancePolicyPanel
        policy={createPolicy()}
        runners={createRunners()}
        isLoading={false}
        isPending={false}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByLabelText('Policy JSON');
    expect(String((textarea as HTMLTextAreaElement).value)).toContain(
      '"defaultPriority": "p2"'
    );
    expect(String((textarea as HTMLTextAreaElement).value)).toContain(
      '"runnerSelection"'
    );

    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify(
          {
            priorityPolicy: {
              defaultPriority: 'p1',
              severityOverrides: {
                critical: 'p0'
              }
            },
            autoActionPolicy: {
              defaultEligibility: 'suggest_only'
            },
            deliveryPolicy: {
              commitMode: 'squash',
              autoCloseIssueOnApprovedDelivery: false
            },
            runnerSelection: {
              defaultRunnerId: 'runner-1',
              discoveryRunnerId: 'runner-2',
              triageRunnerId: null,
              planningRunnerId: null,
              executionRunnerId: 'runner-3'
            }
          },
          null,
          2
        )
      }
    });
    await user.click(screen.getByRole('button', { name: 'Save Policy' }));

    expect(onSubmit).toHaveBeenCalledWith({
      priorityPolicy: {
        defaultPriority: 'p1',
        severityOverrides: {
          critical: 'p0'
        }
      },
      autoActionPolicy: {
        defaultEligibility: 'suggest_only'
      },
      deliveryPolicy: {
        commitMode: 'squash',
        autoCloseIssueOnApprovedDelivery: false
      },
      runnerSelection: {
        defaultRunnerId: 'runner-1',
        discoveryRunnerId: 'runner-2',
        triageRunnerId: null,
        planningRunnerId: null,
        executionRunnerId: 'runner-3'
      }
    });
  });

  it('应支持通过下拉更新 runner selection', async () => {
    const { user } = renderWithProviders(
      <GovernancePolicyPanel
        policy={createPolicy()}
        runners={createRunners()}
        isLoading={false}
        isPending={false}
        onSubmit={onSubmit}
      />
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Discovery Runner' }),
      'runner-1'
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Execution Runner' }),
      'runner-2'
    );
    await user.click(screen.getByRole('button', { name: 'Save Policy' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        runnerSelection: {
          defaultRunnerId: null,
          discoveryRunnerId: 'runner-1',
          triageRunnerId: null,
          planningRunnerId: null,
          executionRunnerId: 'runner-2'
        }
      })
    );
  });
});
