import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationTaskStatus } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';
import { useErrorMessage } from '@/hooks/use-error-message';

import { ProjectNotificationsPage } from './ProjectNotificationsPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('@/features/notifications/hooks/use-notification-channels', () => ({
  useNotificationChannels: vi.fn()
}));

vi.mock('@/features/notifications/hooks/use-notification-tasks', () => ({
  useNotificationTasks: vi.fn(),
  useRetryTask: vi.fn()
}));

const notificationChannelHooks = await import(
  '@/features/notifications/hooks/use-notification-channels'
);
const notificationTaskHooks = await import(
  '@/features/notifications/hooks/use-notification-tasks'
);

function mockProjectPageData() {
  vi.mocked(useProjectPageData).mockReturnValue({
    id: 'project-1',
    project: null,
    projects: [],
    isLoading: false,
    isNotFound: false,
    goToProjects: vi.fn(),
    goToProjectTab: vi.fn()
  });
}

describe('ProjectNotificationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProjectPageData();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    vi.mocked(notificationChannelHooks.useNotificationChannels).mockReturnValue({
      data: [
        {
          id: 'channel-1',
          scopeId: 'project-1',
          name: '本地通知',
          capabilityId: 'local-notification',
          config: {},
          filter: { messageTypes: ['session.*'] },
          enabled: true,
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z'
        }
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as never);
  });

  it('应展示统一内部消息字段，并允许重试 failed 任务', async () => {
    const mutate = vi.fn();

    vi.mocked(notificationTaskHooks.useNotificationTasks).mockReturnValue({
      data: [
        {
          id: 'task-1',
          scopeId: 'project-1',
          channelId: 'channel-1',
          channelName: '本地通知',
          channelDeleted: false,
          messageId: 'message-1',
          messageType: 'session.completed',
          messageTitle: '会话执行完成',
          status: NotificationTaskStatus.Failed,
          lastError: 'system notification unavailable',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z'
        }
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    } as never);
    vi.mocked(notificationTaskHooks.useRetryTask).mockReturnValue({
      mutate,
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectNotificationsPage />);

    expect(screen.getByText('会话执行完成')).toBeInTheDocument();
    expect(screen.getByText('session.completed')).toBeInTheDocument();
    expect(screen.getByText('system notification unavailable')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '重试通知任务 会话执行完成'
      })
    );

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        onError: expect.any(Function)
      })
    );
  });

  it('已删除通道的失败任务应保留历史，但不提供重试入口', () => {
    vi.mocked(notificationTaskHooks.useNotificationTasks).mockReturnValue({
      data: [
        {
          id: 'task-2',
          scopeId: 'project-1',
          channelId: null,
          channelName: '历史通道',
          channelDeleted: true,
          messageId: 'message-2',
          messageType: 'manual.test',
          messageTitle: '已删除通道的历史消息',
          status: NotificationTaskStatus.Failed,
          lastError: '通道已被删除',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z'
        }
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    } as never);
    vi.mocked(notificationTaskHooks.useRetryTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    } as never);

    renderWithProviders(<ProjectNotificationsPage />);

    expect(screen.getByText('历史通道')).toBeInTheDocument();
    expect(screen.getByText('已删除')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: '重试通知任务 已删除通道的历史消息'
      })
    ).not.toBeInTheDocument();
  });

  it('通道过滤应支持已删除通道的历史快照', async () => {
    vi.mocked(notificationTaskHooks.useNotificationTasks).mockReturnValue({
      data: [
        {
          id: 'task-1',
          scopeId: 'project-1',
          channelId: 'channel-1',
          channelName: '本地通知',
          channelDeleted: false,
          messageId: 'message-1',
          messageType: 'session.completed',
          messageTitle: '当前通道消息',
          status: NotificationTaskStatus.Success,
          lastError: null,
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z'
        },
        {
          id: 'task-2',
          scopeId: 'project-1',
          channelId: null,
          channelName: '历史通道',
          channelDeleted: true,
          messageId: 'message-2',
          messageType: 'manual.test',
          messageTitle: '已删除通道消息',
          status: NotificationTaskStatus.Failed,
          lastError: '通道已被删除',
          createdAt: '2026-04-04T10:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z'
        }
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    } as never);
    vi.mocked(notificationTaskHooks.useRetryTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectNotificationsPage />);

    expect(screen.getByRole('option', { name: '历史通道（已删除）' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('通道过滤'), 'deleted:历史通道');

    expect(screen.getByText('已删除通道消息')).toBeInTheDocument();
    expect(screen.queryByText('当前通道消息')).not.toBeInTheDocument();
  });

  it('查询失败时应展示错误空态，而不是误报为无数据', () => {
    vi.mocked(notificationTaskHooks.useNotificationTasks).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: new Error('boom'),
      refetch: vi.fn()
    } as never);
    vi.mocked(notificationTaskHooks.useRetryTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    } as never);

    renderWithProviders(<ProjectNotificationsPage />);

    expect(screen.getByText('通知记录加载失败')).toBeInTheDocument();
    expect(screen.queryByText('暂无通知记录')).not.toBeInTheDocument();
  });
});
