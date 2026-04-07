import { screen, waitFor, within } from '@testing-library/react';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  GovernanceReviewQueueItemKind,
  type GovernanceScopeOverview,
  type GovernanceReviewQueueItem,
  type Project
} from '@agent-workbench/shared';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useGovernanceRetryBaselineMutation,
  useGovernanceRetryDiscoveryMutation,
  useGovernanceRetryPlanningQueueMutation,
  useGovernanceRetryTriageMutation
} from '@/features/governance/hooks/use-governance-mutations';
import { useGovernanceReviewQueue } from '@/features/governance/hooks/use-governance-queries';
import { renderWithProviders } from '@/test/render';

import { ProjectReviewsPage } from './ProjectReviewsPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-queries', () => ({
  useGovernanceReviewQueue: vi.fn()
}));

vi.mock('@/features/governance/hooks/use-governance-mutations', () => ({
  useGovernanceRetryBaselineMutation: vi.fn(),
  useGovernanceRetryDiscoveryMutation: vi.fn(),
  useGovernanceRetryTriageMutation: vi.fn(),
  useGovernanceRetryPlanningQueueMutation: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => vi.fn()
}));

vi.mock('@/features/governance/components/GovernanceSessionHistorySheet', () => ({
  GovernanceSessionHistorySheet: ({
    title,
    triggerLabel = '查看日志'
  }: {
    title: string;
    triggerLabel?: string;
  }) => <button type="button">{`${triggerLabel}:${title}`}</button>
}));

function createProject(): Project {
  return {
    id: 'project-1',
    name: 'code-code',
    description: null,
    repoGitUrl: 'git@github.com:pood1e/code-code.git',
    workspaceRootPath: '/tmp/workbench',
    docGitUrl: null,
    createdAt: '2026-04-06T00:00:00.000Z',
    updatedAt: '2026-04-06T00:00:00.000Z'
  };
}

function createQueryResult<TData>(data: TData): UseQueryResult<TData, Error> {
  return {
    data,
    error: null,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    status: 'success',
    fetchStatus: 'idle',
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    refetch: vi.fn(),
    remove: vi.fn(),
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isPaused: false,
    isEnabled: true,
    promise: Promise.resolve(data)
  } as unknown as UseQueryResult<TData, Error>;
}

function createMutationResult<TData, TVariables>(): UseMutationResult<
  TData,
  Error,
  TVariables,
  unknown
> {
  return {
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isPaused: false,
    isPending: false,
    isSuccess: false,
    status: 'idle',
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    variables: null,
    submittedAt: 0,
    failureCount: 0,
    failureReason: null,
    context: undefined
  } as unknown as UseMutationResult<TData, Error, TVariables, unknown>;
}

function createQueueItem(
  overrides: Partial<GovernanceReviewQueueItem> = {}
): GovernanceReviewQueueItem {
  return {
    kind: GovernanceReviewQueueItemKind.Discovery,
    scopeId: 'project-1',
    subjectId: 'scope-1',
    issueId: null,
    title: 'Discovery 需要人工处理',
    status: 'needs_human_review',
    failureCode: 'DISCOVERY_TIMEOUT',
    failureMessage: 'discovery stage timed out',
    sessionId: 'session-1',
    updatedAt: '2026-04-06T12:00:00.000Z',
    ...overrides
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProjectReviewsPage() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:id/reviews"
        element={
          <>
            <ProjectReviewsPage />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/projects/:id/resources/:issueId"
        element={<RouteEcho />}
      />
    </Routes>,
    {
      route: '/projects/project-1/reviews'
    }
  );
}

describe('ProjectReviewsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useProjectPageData).mockReturnValue({
      id: 'project-1',
      project: createProject(),
      projects: [createProject()],
      isLoading: false,
      isNotFound: false,
      goToProjects: vi.fn(),
      goToProjectTab: vi.fn()
    });
    vi.mocked(useGovernanceReviewQueue).mockReturnValue(
      createQueryResult([
        createQueueItem(),
        createQueueItem({
          kind: GovernanceReviewQueueItemKind.ChangeUnit,
          subjectId: 'change-unit-1',
          issueId: 'issue-1',
          title: '人工处理变更单元',
          status: 'ready',
          failureCode: null,
          updatedAt: '2026-04-06T10:00:00.000Z'
        })
      ])
    );
    vi.mocked(useGovernanceRetryBaselineMutation).mockReturnValue(
      createMutationResult<GovernanceScopeOverview, void>()
    );
    vi.mocked(useGovernanceRetryDiscoveryMutation).mockReturnValue(
      createMutationResult<GovernanceScopeOverview, void>()
    );
    vi.mocked(useGovernanceRetryTriageMutation).mockReturnValue(
      createMutationResult()
    );
    vi.mocked(useGovernanceRetryPlanningQueueMutation).mockReturnValue(
      createMutationResult()
    );
  });

  it('应展示可扫描的审核列表，并允许过滤和重试 discovery', async () => {
    const retryMutation = createMutationResult<void, void>();
    const typedRetryMutation =
      retryMutation as unknown as UseMutationResult<
        GovernanceScopeOverview,
        Error,
        void,
        unknown
      >;
    vi.mocked(useGovernanceRetryDiscoveryMutation).mockReturnValue(
      typedRetryMutation
    );

    const { user } = renderProjectReviewsPage();

    expect(screen.getByRole('heading', { name: '审核队列' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '类型' })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: '阻塞原因' })
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '审核类型过滤' }),
      GovernanceReviewQueueItemKind.Discovery
    );

    expect(screen.getByText('Discovery 需要人工处理')).toBeInTheDocument();
    expect(screen.queryByText('人工处理变更单元')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => {
      expect(typedRetryMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('change unit 队列项应跳转到资源 issue 详情，并保持不可重试按钮稳定', async () => {
    const { user } = renderProjectReviewsPage();

    const changeUnitRow = screen.getByText('人工处理变更单元').closest('tr');
    expect(changeUnitRow).not.toBeNull();
    const issueButton = within(changeUnitRow as HTMLElement).getByRole('button', {
      name: '打开 Issue'
    });

    const retryButtons = screen.getAllByRole('button', { name: '重试' });
    expect(retryButtons[1]).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '查看日志:人工处理变更单元 · Agent 日志' })
    ).toBeInTheDocument();

    await user.click(issueButton);

    await waitFor(() => {
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/projects/project-1/resources/issue-1'
      );
    });
  });

  it('应支持按搜索词过滤审核项', async () => {
    const { user } = renderProjectReviewsPage();

    await user.type(
      screen.getByPlaceholderText('搜索标题、subject 或失败原因'),
      'change-unit-1'
    );

    expect(screen.getByText('人工处理变更单元')).toBeInTheDocument();
    expect(
      screen.queryByText('Discovery 需要人工处理')
    ).not.toBeInTheDocument();
  });
});
