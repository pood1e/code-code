import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GovernanceAutoActionEligibility,
  GovernanceDeliveryCommitMode,
  GovernancePriority,
  GovernanceSeverity,
  type GovernancePolicy
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { GovernancePolicyPanel } from './GovernancePolicyPanel';

const onSubmit = vi.fn();

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
        isLoading={false}
        isPending={false}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByLabelText('Policy JSON');
    expect(String((textarea as HTMLTextAreaElement).value)).toContain(
      '"defaultPriority": "p2"'
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
      }
    });
  });
});
