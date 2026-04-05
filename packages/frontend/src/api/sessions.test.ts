import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStatus, type OutputChunk } from '@agent-workbench/shared';

import { apiClient } from './client';
import {
  cancelSession,
  createSession,
  createSessionEventSource,
  disposeSession,
  editSessionMessage,
  getSession,
  listSessionMessages,
  listSessions,
  parseSessionEvent,
  reloadSession,
  sendSessionMessage
} from './sessions';

vi.mock('./client', () => ({
  apiBaseUrl: '/api',
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('sessions api helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应请求会话列表、详情、创建和删除', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [{ id: 'session-1' }] })
      .mockResolvedValueOnce({ data: { id: 'session-1' } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'session-2' } });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });

    await expect(listSessions('project-1')).resolves.toEqual([
      { id: 'session-1' }
    ]);
    await expect(getSession('session-1')).resolves.toEqual({
      id: 'session-1'
    });
    await expect(
      createSession({
        scopeId: 'project-1',
        runnerId: 'runner-1',
        workspaceResources: [],
        skillIds: [],
        ruleIds: [],
        mcps: [],
        runnerSessionConfig: {}
      })
    ).resolves.toEqual({ id: 'session-2' });
    await expect(disposeSession('session-2')).resolves.toBeUndefined();

    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/sessions', {
      params: { scopeId: 'project-1' }
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/sessions/session-1');
    expect(apiClient.post).toHaveBeenCalledWith('/sessions', {
      scopeId: 'project-1',
      runnerId: 'runner-1',
      workspaceResources: [],
      skillIds: [],
      ruleIds: [],
      mcps: [],
      runnerSessionConfig: {}
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/sessions/session-2');
  });

  it('应请求会话消息列表、发送、取消、重跑和编辑', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: [{ id: 'message-1' }],
        nextCursor: 'cursor-1'
      }
    });
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'message-2' }],
          nextCursor: null
        }
      })
      .mockResolvedValueOnce({ data: { id: 'session-1', status: SessionStatus.Ready } })
      .mockResolvedValueOnce({ data: { id: 'session-1', status: SessionStatus.Ready } })
      .mockResolvedValueOnce({ data: { id: 'session-1', status: SessionStatus.Ready } });

    await expect(
      listSessionMessages('session-1', 'cursor-0', 20)
    ).resolves.toEqual({
      data: [{ id: 'message-1' }],
      nextCursor: 'cursor-1'
    });
    await expect(
      sendSessionMessage('session-1', {
        input: { prompt: 'hello' },
        runtimeConfig: { model: 'qwen' }
      })
    ).resolves.toEqual({
      data: [{ id: 'message-2' }],
      nextCursor: null
    });
    await expect(cancelSession('session-1')).resolves.toEqual({
      id: 'session-1',
      status: SessionStatus.Ready
    });
    await expect(reloadSession('session-1')).resolves.toEqual({
      id: 'session-1',
      status: SessionStatus.Ready
    });
    await expect(
      editSessionMessage('session-1', 'message-1', {
        input: { prompt: 'edited' },
        runtimeConfig: {}
      })
    ).resolves.toEqual({
      id: 'session-1',
      status: SessionStatus.Ready
    });

    expect(apiClient.get).toHaveBeenCalledWith('/sessions/session-1/messages', {
      params: { cursor: 'cursor-0', limit: 20 }
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      '/sessions/session-1/messages',
      {
        input: { prompt: 'hello' },
        runtimeConfig: { model: 'qwen' }
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/sessions/session-1/cancel'
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      '/sessions/session-1/reload'
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      4,
      '/sessions/session-1/messages/message-1/edit',
      {
        input: { prompt: 'edited' },
        runtimeConfig: {}
      }
    );
  });

  it('parseSessionEvent 应把 EventSource 字符串 data 解析为 OutputChunk', () => {
    const chunk: OutputChunk = {
      kind: 'session_status',
      sessionId: 'session_1',
      eventId: 1,
      timestampMs: 123,
      data: {
        status: SessionStatus.Ready,
        prevStatus: SessionStatus.Running
      }
    };

    expect(parseSessionEvent({ data: JSON.stringify(chunk) })).toEqual(chunk);
  });

  it('createSessionEventSource 应携带 afterEventId 查询参数', () => {
    const eventSourceMock = vi.fn();
    vi.stubGlobal('EventSource', eventSourceMock);

    createSessionEventSource('session_1', 42);

    expect(eventSourceMock).toHaveBeenCalledWith(
      '/api/sessions/session_1/events?afterEventId=42'
    );

    vi.unstubAllGlobals();
  });
});
