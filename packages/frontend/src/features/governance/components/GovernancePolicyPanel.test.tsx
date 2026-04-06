import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AgentRunnerSummary,
  GovernanceAgentMergeStrategy,
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
    sourceSelection: {
      repoBranch: null,
      docBranch: null
    },
    agentStrategy: {
      defaultRunnerIds: [],
      discovery: null,
      triage: null,
      planning: null,
      execution: null
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
      '"sourceSelection"'
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
            sourceSelection: {
              repoBranch: 'release/governance',
              docBranch: 'docs'
            },
            agentStrategy: {
              defaultRunnerIds: ['runner-1'],
              discovery: {
                runnerIds: ['runner-1', 'runner-2'],
                fanoutCount: 2,
                mergeStrategy: 'union_dedup'
              },
              triage: null,
              planning: null,
              execution: {
                runnerIds: ['runner-2'],
                fanoutCount: 1,
                mergeStrategy: 'single'
              }
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
      sourceSelection: {
        repoBranch: 'release/governance',
        docBranch: 'docs'
      },
      agentStrategy: {
        defaultRunnerIds: ['runner-1'],
        discovery: {
          runnerIds: ['runner-1', 'runner-2'],
          fanoutCount: 2,
          mergeStrategy: 'union_dedup'
        },
        triage: null,
        planning: null,
        execution: {
          runnerIds: ['runner-2'],
          fanoutCount: 1,
          mergeStrategy: 'single'
        }
      }
    });
  });

  it('应支持通过控件更新分支和 stage runner 策略', async () => {
    const { user } = renderWithProviders(
      <GovernancePolicyPanel
        policy={createPolicy()}
        runners={createRunners()}
        isLoading={false}
        isPending={false}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Repo Branch'), 'release/governance');
    await user.click(
      screen.getAllByRole('checkbox', {
        name: 'MiniMax 2.7 Runner (openai-responses)'
      })[0]!
    );
    await user.click(screen.getAllByRole('checkbox', { name: 'Override' })[0]!);
    await user.click(screen.getAllByRole('checkbox', { name: 'MiniMax 2.7 Runner (openai-responses)' })[1]!);
    await user.click(screen.getAllByRole('checkbox', { name: 'Execution Runner (mock)' })[1]!);
    fireEvent.change(screen.getByLabelText('Discovery Merge Strategy'), {
      target: { value: GovernanceAgentMergeStrategy.BestOfN }
    });
    fireEvent.change(screen.getByLabelText('Discovery Fanout'), {
      target: { value: '2' }
    });

    await user.click(screen.getByRole('button', { name: 'Save Policy' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSelection: {
          repoBranch: 'release/governance',
          docBranch: null
        },
        agentStrategy: expect.objectContaining({
          defaultRunnerIds: ['runner-1'],
          discovery: {
            runnerIds: ['runner-1', 'runner-2'],
            fanoutCount: 2,
            mergeStrategy: GovernanceAgentMergeStrategy.BestOfN
          }
        })
      })
    );
  });
});
