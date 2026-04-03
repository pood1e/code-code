import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MessageRole,
  MessageStatus,
  SessionStatus,
  type AgentRunnerSummary,
  type RunnerTypeResponse,
  type SessionDetail,
  type SessionMessageDetail,
  type SessionSummary
} from '@agent-workbench/shared';

import {
  getAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { getSession, listSessionMessages, listSessions } from '@/api/sessions';
import { createTestQueryClient } from '@/test/render';

import { useSessionPageQueries } from './use-session-page-queries';

vi.mock('@/api/agent-runners', () => ({
  getAgentRunner: vi.fn(),
  listAgentRunners: vi.fn(),
  listAgentRunnerTypes: vi.fn()
}));

vi.mock('@/api/profiles', () => ({
  listProfiles: vi.fn()
}));

vi.mock('@/api/resources', () => ({
  listResources: vi.fn()
}));

vi.mock('@/api/sessions', () => ({
  getSession: vi.fn(),
  listSessionMessages: vi.fn(),
  listSessions: vi.fn()
}));

function createSessionSummary(id: string): SessionSummary {
  return {
    id,
    scopeId: 'project-1',
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createSessionDetail(id: string): SessionDetail {
  return {
    ...createSessionSummary(id),
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

function createMessage(id: string, prompt: string): SessionMessageDetail {
  return {
    id,
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
    inputContent: { prompt },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 1,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner',
    capabilities: {
      skill: true,
      rule: true,
      mcp: true
    },
    runnerConfigSchema: { fields: [] },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function createRunner(): AgentRunnerSummary {
  return {
    id: 'runner-1',
    name: 'Mock Runner',
    description: null,
    type: 'mock',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

describe('useSessionPageQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([createRunnerType()]);
    vi.mocked(listAgentRunners).mockResolvedValue([createRunner()]);
    vi.mocked(listProfiles).mockResolvedValue([]);
    vi.mocked(listResources).mockResolvedValue([]);
    vi.mocked(getAgentRunner).mockResolvedValue({
      ...createRunner(),
      runnerConfig: {}
    });
    vi.mocked(listSessions).mockResolvedValue([createSessionSummary('session-1')]);
    vi.mocked(getSession).mockResolvedValue(createSessionDetail('session-1'));
  });

  it('未选中会话时不应请求详情/消息，messagesReady 应为 false', async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useSessionPageQueries('project-1', null, false),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await waitFor(() => {
      expect(result.current.sessionsQuery.data).toHaveLength(1);
    });

    expect(getSession).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();
    expect(result.current.selectedSessionMessagesReady).toBe(false);
    expect(result.current.flatMessages).toEqual([]);
  });

  it('应把消息分页按时间顺序拼接，并生成 runner 映射和选中 RunnerType', async () => {
    vi.mocked(listSessionMessages)
      .mockResolvedValueOnce({
        data: [createMessage('message-new', 'new')],
        nextCursor: 'message-old'
      })
      .mockResolvedValueOnce({
        data: [createMessage('message-old', 'old')],
        nextCursor: null
      });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(
      () => useSessionPageQueries('project-1', 'session-1', false),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
    );

    await waitFor(() => {
      expect(result.current.selectedSessionMessagesReady).toBe(true);
    });

    await result.current.sessionMessagesQuery.fetchNextPage();

    await waitFor(() => {
      expect(result.current.flatMessages.map((message) => message.id)).toEqual([
        'message-old',
        'message-new'
      ]);
    });

    expect(result.current.runnerNameById).toEqual({
      'runner-1': 'Mock Runner'
    });
    expect(result.current.selectedRunnerType?.id).toBe('mock');
  });
});
