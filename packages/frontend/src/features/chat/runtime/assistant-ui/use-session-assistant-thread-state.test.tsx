import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';
import {
  MessageRole,
  MessageStatus,
  SessionStatus
} from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { createTestQueryClient } from '@/test/render';

import type { SessionMessageRuntimeMap } from './thread-adapter';
import { useSessionAssistantThreadState } from './use-session-assistant-thread-state';

vi.mock('@/api/agent-runners', () => ({
  probeAgentRunnerContext: vi.fn()
}));

function createSession(): SessionDetail {
  return {
    id: 'session-1',
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

function createStructuredRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: { fields: [] },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        },
        {
          name: 'branch',
          label: 'Branch',
          kind: 'string',
          required: false
        }
      ]
    },
    runtimeConfigSchema: {
      fields: [
        {
          name: 'maxTurns',
          label: 'Max Turns',
          kind: 'integer',
          required: false
        }
      ]
    }
  };
}

function createUserMessage(
  overrides: Partial<SessionMessageDetail> = {}
): SessionMessageDetail {
  return {
    id: 'message-user',
    sessionId: 'session-1',
    role: MessageRole.User,
    status: MessageStatus.Complete,
    inputContent: { prompt: '原始问题', branch: 'feature/test' },
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: 1,
    toolUses: [],
    metrics: [],
    createdAt: '2026-04-03T10:00:00.000Z',
    ...overrides
  };
}

function renderSessionAssistantThreadState(options: {
  messages?: SessionMessageDetail[];
  onSend?: (payload: SendSessionMessageInput) => Promise<void>;
  onEdit?: (
    messageId: string,
    payload: SendSessionMessageInput
  ) => Promise<void>;
  runnerType?: RunnerTypeResponse | undefined;
  runtimeState?: SessionMessageRuntimeMap;
  session?: SessionDetail;
} = {}) {
  const {
    messages = [createUserMessage()],
    onSend = vi.fn(),
    onEdit = vi.fn(),
    runtimeState = {},
    session = createSession()
  } = options;
  const queryClient = createTestQueryClient();
  const effectiveRunnerType =
    Object.prototype.hasOwnProperty.call(options, 'runnerType')
      ? options.runnerType
      : createStructuredRunnerType();

  return renderHook(
    () =>
      useSessionAssistantThreadState({
        messages,
        onEdit,
        onSend,
        runnerType: effectiveRunnerType,
        runtimeState,
        session
      }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }
  );
}

describe('useSessionAssistantThreadState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(probeAgentRunnerContext).mockResolvedValue({});
  });

  it('发送成功后应重置额外输入草稿，避免串到下一条消息', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { result } = renderSessionAssistantThreadState({ onSend });

    result.current.handleAdditionalValueChange('branch', 'feature/test');

    await result.current.sendMessage('第一条消息');
    await result.current.sendMessage('第二条消息');

    expect(onSend).toHaveBeenNthCalledWith(1, {
      input: {
        prompt: '第一条消息',
        branch: 'feature/test'
      },
      runtimeConfig: {}
    });
    expect(onSend).toHaveBeenNthCalledWith(2, {
      input: {
        prompt: '第二条消息'
      },
      runtimeConfig: {}
    });
  });

  it('runnerType 未加载时应退化为文本 prompt 发送', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { result } = renderSessionAssistantThreadState({
      onSend,
      runnerType: undefined
    });

    await result.current.sendMessage('  hello while loading  ');

    expect(onSend).toHaveBeenCalledWith({
      input: {
        prompt: 'hello while loading'
      }
    });
  });

  it('编辑消息时应复用原消息额外字段并带上当前 runtimeConfig', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderSessionAssistantThreadState({ onEdit });

    result.current.handleRuntimeValueChange('maxTurns', '4');
    await result.current.editMessage('message-user', '修改后的问题');

    expect(onEdit).toHaveBeenCalledWith('message-user', {
      input: {
        prompt: '修改后的问题',
        branch: 'feature/test'
      },
      runtimeConfig: {
        maxTurns: 4
      }
    });
  });
});
