import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GovernanceChangePlanStatus,
  GovernanceIssueKind,
  GovernanceIssueStatus,
  type GovernanceIssueSummary
} from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { GovernanceIssueList } from './GovernanceIssueList';

function createIssue(
  overrides: Partial<GovernanceIssueSummary> = {}
): GovernanceIssueSummary {
  return {
    id: 'issue-1',
    scopeId: 'project-1',
    title: '治理 backlog 需要重排',
    statement: '当前列表排序不能反映处理优先级',
    kind: GovernanceIssueKind.Improvement,
    categories: ['governance'],
    tags: [],
    relatedFindingIds: [],
    status: GovernanceIssueStatus.Open,
    affectedTargets: [{ kind: 'file', ref: 'src/governance.tsx' }],
    impactSummary: '扫描效率低',
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z',
    relatedFindingCount: 0,
    latestAssessment: null,
    latestResolutionDecision: null,
    latestChangePlanStatus: GovernanceChangePlanStatus.Draft,
    latestPlanningAttempt: null,
    ...overrides
  };
}

describe('GovernanceIssueList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应展示主次信息，并暴露当前选中项语义', async () => {
    const onSelect = vi.fn();

    const { user } = renderWithProviders(
      <GovernanceIssueList
        issues={[
          createIssue(),
          createIssue({
            id: 'issue-2',
            title: '缺少搜索筛选',
            impactSummary: '',
            statement: '需要支持 backlog 搜索',
            affectedTargets: [{ kind: 'file', ref: 'src/backlog.tsx' }]
          })
        ]}
        selectedId="issue-1"
        onSelect={onSelect}
      />
    );

    expect(
      screen.getByRole('button', { name: /治理 backlog 需要重排/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('扫描效率低')).toBeInTheDocument();
    expect(screen.getByText('需要支持 backlog 搜索')).toBeInTheDocument();
    expect(screen.getByText('src/backlog.tsx')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /缺少搜索筛选/i }));

    expect(onSelect).toHaveBeenCalledWith('issue-2');
  });
});
