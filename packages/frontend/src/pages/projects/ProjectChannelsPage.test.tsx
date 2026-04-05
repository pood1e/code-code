import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SchemaDescriptor } from '@agent-workbench/shared';

import { renderWithProviders } from '@/test/render';

import { ProjectChannelsPage } from './ProjectChannelsPage';
import { useProjectPageData } from './use-project-page-data';

vi.mock('./use-project-page-data', () => ({
  useProjectPageData: vi.fn()
}));

vi.mock('@/features/notifications/hooks/use-notification-channels', () => ({
  useNotificationCapabilities: vi.fn(),
  useNotificationChannels: vi.fn(),
  useCreateChannel: vi.fn(),
  useUpdateChannel: vi.fn(),
  useDeleteChannel: vi.fn()
}));

const notificationHooks = await import(
  '@/features/notifications/hooks/use-notification-channels'
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

function mockNotificationHooks(overrides?: {
  capabilities?: Array<{
    id: string;
    name: string;
    description: string;
    configSchema: SchemaDescriptor;
  }>;
  channels?: Array<{
    id: string;
    scopeId: string;
    name: string;
    capabilityId: string;
    config: Record<string, unknown>;
    filter: { messageTypes: string[] };
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}) {
  vi.mocked(notificationHooks.useNotificationCapabilities).mockReturnValue({
    data: overrides?.capabilities ?? [],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  } as never);
  vi.mocked(notificationHooks.useNotificationChannels).mockReturnValue({
    data: overrides?.channels ?? [],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  } as never);
  vi.mocked(notificationHooks.useCreateChannel).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false
  } as never);
  vi.mocked(notificationHooks.useUpdateChannel).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false
  } as never);
  vi.mocked(notificationHooks.useDeleteChannel).mockReturnValue({
    mutate: vi.fn(),
    isPending: false
  } as never);
}

describe('ProjectChannelsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProjectPageData();
  });

  it('没有已注册通知能力时，应禁用创建入口并展示说明', () => {
    mockNotificationHooks();

    renderWithProviders(<ProjectChannelsPage />);

    expect(screen.getByText('暂无可用通知能力')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '新建通道'
      })
    ).toBeDisabled();
  });

  it('创建通道时，不再暴露原始 configJson 输入框', async () => {
    mockNotificationHooks({
      capabilities: [
        {
          id: 'local-notification',
          name: '本地通知',
          description: '通过宿主机系统通知中心发送本地通知。',
          configSchema: { fields: [] }
        }
      ]
    });

    const { user } = renderWithProviders(<ProjectChannelsPage />);

    await user.click(screen.getAllByRole('button', { name: '新建通道' })[0]);

    expect(screen.getByLabelText('消息过滤器（JSON）')).toBeInTheDocument();
    expect(screen.queryByText('渠道配置（JSON）')).not.toBeInTheDocument();
    expect(screen.getByText('通过宿主机系统通知中心发送本地通知。')).toBeInTheDocument();
  });

  it('能力 schema 提供配置字段时，应按字段渲染并提交结构化 config', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});

    mockNotificationHooks({
      capabilities: [
        {
          id: 'webhook',
          name: 'Webhook',
          description: '发送到自定义 Webhook。',
          configSchema: {
            fields: [
              {
                name: 'endpoint',
                label: 'Endpoint',
                kind: 'url',
                required: true
              }
            ]
          }
        }
      ]
    });
    vi.mocked(notificationHooks.useCreateChannel).mockReturnValue({
      mutateAsync,
      isPending: false
    } as never);

    const { user } = renderWithProviders(<ProjectChannelsPage />);

    await user.click(screen.getAllByRole('button', { name: '新建通道' })[0]);
    await user.type(screen.getByLabelText('名称'), 'Webhook 通道');
    await user.type(screen.getByLabelText('Endpoint'), 'https://example.com/hook');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      scopeId: 'project-1',
      name: 'Webhook 通道',
      capabilityId: 'webhook',
      config: {
        endpoint: 'https://example.com/hook'
      },
      filter: {
        messageTypes: ['session.*']
      },
      enabled: true
    });
  });

});
