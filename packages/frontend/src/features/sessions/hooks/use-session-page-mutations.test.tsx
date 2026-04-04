import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDetail } from '@agent-workbench/shared';
import { SessionStatus } from '@agent-workbench/shared';

import {
  cancelSession,
  disposeSession,
  editSessionMessage,
  reloadSession,
  sendSessionMessage
} from '@/api/sessions';
import { queryKeys } from '@/query/query-keys';
import { createTestQueryClient } from '@/test/render';

import { useSessionPageMutations } from './use-session-page-mutations';

vi.mock('@/api/sessions', () => ({
  cancelSession: vi.fn(),
  disposeSession: vi.fn(),
  editSessionMessage: vi.fn(),
  reloadSession: vi.fn(),
  sendSessionMessage: vi.fn()
}));

function createSessionDetail(id: string): SessionDetail {
  return {
    id,
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z',
    platformSessionConfig: {
      cwd: '/tmp',
      skillIds: [],
      ruleIds: [],
      mcps: []
    },
    runnerSessionConfig: {},
    defaultRuntimeConfig: null
  };
}

describe('useSessionPageMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('发送消息成功后应失效当前会话 messages 查询', async () => {
    vi.mocked(sendSessionMessage).mockResolvedValue({
      data: [],
      nextCursor: null
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.sessions.messages('session-1'), {
      pages: [{ data: [], nextCursor: null }],
      pageParams: [undefined]
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useSessionPageMutations({
          selectedSessionId: 'session-1',
          projectId: 'project-1',
          clearSessionRuntimeState: vi.fn()
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await act(async () => {
      await result.current.sendMutation.mutateAsync({
        input: { prompt: 'Hello' },
        runtimeConfig: {}
      });
    });

    expect(sendSessionMessage).toHaveBeenCalledWith('session-1', {
      input: { prompt: 'Hello' },
      runtimeConfig: {}
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.messages('session-1')
    });
  });

  it('删除会话成功后应清理详情、消息缓存、列表缓存和运行态', async () => {
    vi.mocked(disposeSession).mockResolvedValue(undefined);
    const clearSessionRuntimeState = vi.fn();
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(queryKeys.sessions.list('project-1'), [
      { id: 'session-1' },
      { id: 'session-2' }
    ]);
    queryClient.setQueryData(queryKeys.sessions.detail('session-2'), {
      id: 'session-2'
    });
    queryClient.setQueryData(queryKeys.sessions.messages('session-2'), {
      pages: [{ data: [{ id: 'message-1' }], nextCursor: null }],
      pageParams: [undefined]
    });

    const { result } = renderHook(
      () =>
        useSessionPageMutations({
          selectedSessionId: 'session-2',
          projectId: 'project-1',
          clearSessionRuntimeState
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await act(async () => {
      await result.current.disposeMutation.mutateAsync('session-2');
    });

    await waitFor(() => {
      expect(clearSessionRuntimeState).toHaveBeenCalledWith('session-2');
    });
    expect(queryClient.getQueryData(queryKeys.sessions.detail('session-2'))).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.sessions.messages('session-2'))
    ).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.sessions.list('project-1'))).toEqual([
      { id: 'session-1' }
    ]);
  });

  it('reload/edit/cancel 应把当前会话 id 透传给 API', async () => {
    vi.mocked(cancelSession).mockResolvedValue(
      createSessionDetail('session-1')
    );
    vi.mocked(reloadSession).mockResolvedValue(
      createSessionDetail('session-1')
    );
    vi.mocked(editSessionMessage).mockResolvedValue(
      createSessionDetail('session-1')
    );

    const queryClient = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useSessionPageMutations({
          selectedSessionId: 'session-1',
          projectId: 'project-1',
          clearSessionRuntimeState: vi.fn()
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await act(async () => {
      await result.current.cancelMutation.mutateAsync();
      await result.current.reloadMutation.mutateAsync();
      await result.current.editMutation.mutateAsync({
        messageId: 'message-1',
        payload: {
          input: { prompt: 'Edited' },
          runtimeConfig: {}
        }
      });
    });

    expect(cancelSession).toHaveBeenCalledWith('session-1');
    expect(reloadSession).toHaveBeenCalledWith('session-1');
    expect(editSessionMessage).toHaveBeenCalledWith('session-1', 'message-1', {
      input: { prompt: 'Edited' },
      runtimeConfig: {}
    });
  });

  it('invalidateSessionThreadState 应清理运行态，并失效消息/详情/列表缓存', async () => {
    const clearSessionRuntimeState = vi.fn();
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useSessionPageMutations({
          selectedSessionId: 'session-1',
          projectId: 'project-1',
          clearSessionRuntimeState
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await act(async () => {
      await result.current.invalidateSessionThreadState(
        'session-1',
        'project-1'
      );
    });

    expect(clearSessionRuntimeState).toHaveBeenCalledWith('session-1');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.messages('session-1')
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.detail('session-1')
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.list('project-1')
    });
  });

  it('删除会话时若没有 projectId，也应清理详情/消息缓存和运行态', async () => {
    vi.mocked(disposeSession).mockResolvedValue(undefined);
    const clearSessionRuntimeState = vi.fn();
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    queryClient.setQueryData(queryKeys.sessions.detail('session-2'), {
      id: 'session-2'
    });
    queryClient.setQueryData(queryKeys.sessions.messages('session-2'), {
      pages: [{ data: [{ id: 'message-1' }], nextCursor: null }],
      pageParams: [undefined]
    });

    const { result } = renderHook(
      () =>
        useSessionPageMutations({
          selectedSessionId: 'session-2',
          projectId: undefined,
          clearSessionRuntimeState
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await act(async () => {
      await result.current.disposeMutation.mutateAsync('session-2');
    });

    expect(clearSessionRuntimeState).toHaveBeenCalledWith('session-2');
    expect(queryClient.getQueryData(queryKeys.sessions.detail('session-2'))).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.sessions.messages('session-2'))
    ).toBeUndefined();
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.sessions.list('project-1')
    });
  });
});
