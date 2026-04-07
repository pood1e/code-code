import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ProjectNotificationSendPage } from './ProjectNotificationSendPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/notifications/hooks/use-notification-messages', () => ({
  useSendNotificationMessage: vi.fn()
}));

const notificationMessageHooks = await import(
  '@/features/notifications/hooks/use-notification-messages'
);

function mockProjectPageData() {
  const goToProjectTab = vi.fn();

  vi.mocked(useProjectPageData).mockReturnValue({
    id: 'project-1',
    project: {
      id: 'project-1',
      name: 'Alpha',
      description: '',
      workspaceRootPath: '/tmp/project-1',
      repoGitUrl: 'git@github.com:example/repo.git',
      docGitUrl: null,
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T10:00:00.000Z'
    },
    projects: [],
    isLoading: false,
    isNotFound: false,
    goToProjects: vi.fn(),
    goToProjectTab
  });

  return { goToProjectTab };
}

describe('ProjectNotificationSendPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应按统一内部消息结构提交，并在成功后允许跳转到通知记录页', async () => {
    const { goToProjectTab } = mockProjectPageData();
    const mutateAsync = vi.fn().mockResolvedValue({
      messageId: 'message-1',
      createdTaskCount: 2
    });

    vi.mocked(notificationMessageHooks.useSendNotificationMessage).mockReturnValue({
      mutateAsync,
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectNotificationSendPage />);

    await user.clear(screen.getByLabelText('消息类型'));
    await user.type(screen.getByLabelText('消息类型'), 'session.completed');
    await user.type(screen.getByLabelText('消息标题'), '会话执行完成');
    await user.type(screen.getByLabelText('消息内容'), '本次执行已成功结束。');
    await user.selectOptions(screen.getByLabelText('严重级别'), 'success');
    const metadataField = screen.getByLabelText('Metadata（JSON）');
    await user.clear(metadataField);
    await user.click(metadataField);
    await user.paste('{"sessionId":"session-1","source":"manual"}');

    await user.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        scopeId: 'project-1',
        type: 'session.completed',
        title: '会话执行完成',
        body: '本次执行已成功结束。',
        severity: 'success',
        metadata: {
          sessionId: 'session-1',
          source: 'manual'
        }
      });
    });

    expect(screen.getByText('发送成功')).toBeInTheDocument();
    expect(screen.getByText(/已命中 2 个通道/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看记录' }));

    expect(goToProjectTab).toHaveBeenCalledWith('project-1', 'notifications');
  });

  it('未命中任何通道时，应提示未生成任务并引导前往通知渠道', async () => {
    const { goToProjectTab } = mockProjectPageData();
    const mutateAsync = vi.fn().mockResolvedValue({
      messageId: 'message-2',
      createdTaskCount: 0
    });

    vi.mocked(notificationMessageHooks.useSendNotificationMessage).mockReturnValue({
      mutateAsync,
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectNotificationSendPage />);

    await user.type(screen.getByLabelText('消息标题'), '未命中通知');
    await user.type(screen.getByLabelText('消息内容'), '没有通道会收到这条消息。');
    await user.click(screen.getByRole('button', { name: '发送消息' }));

    expect(screen.getByText('未命中任何通道')).toBeInTheDocument();
    expect(
      screen.getByText('本次消息已被系统接收，但当前没有命中任何启用中的通道，因此没有生成通知任务。')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '查看记录' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '前往通知渠道' }));

    expect(goToProjectTab).toHaveBeenCalledWith('project-1', 'channels');
  });

  it('metadata 非法时应在表单内阻止提交', async () => {
    mockProjectPageData();
    const mutateAsync = vi.fn();

    vi.mocked(notificationMessageHooks.useSendNotificationMessage).mockReturnValue({
      mutateAsync,
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectNotificationSendPage />);

    await user.type(screen.getByLabelText('消息标题'), '测试通知');
    await user.type(screen.getByLabelText('消息内容'), '测试内容');
    const metadataField = screen.getByLabelText('Metadata（JSON）');
    await user.clear(metadataField);
    await user.click(metadataField);
    await user.paste('[]');

    await user.click(screen.getByRole('button', { name: '发送消息' }));

    expect(
      screen.getByText('必须是合法 JSON，且顶层必须是对象')
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
