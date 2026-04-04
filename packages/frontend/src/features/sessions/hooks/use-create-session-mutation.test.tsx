import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import {
  type ChatSummary,
  SessionStatus,
  type ProfileDetail
} from '@agent-workbench/shared';

import { createChat } from '@/api/chats';
import {
  parseRunnerConfigSchema,
  type SupportedRunnerConfigSchema
} from '@/lib/runner-config-schema';
import { queryKeys } from '@/query/query-keys';
import { createTestQueryClient } from '@/test/render';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';

import { useCreateSessionMutation } from './use-create-session-mutation';

vi.mock('@/api/chats', () => ({
  createChat: vi.fn()
}));

function createChatSummary(): ChatSummary {
  return {
    id: 'chat-1',
    scopeId: 'project-1',
    sessionId: 'session-1',
    title: null,
    runnerId: 'runner-1',
    runnerType: 'mock',
    status: SessionStatus.Ready,
    lastEventId: 0,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createProfileDetail(): ProfileDetail {
  return {
    id: 'profile-1',
    name: '默认 Profile',
    description: '常用资源组合',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z',
    skills: [],
    mcps: [
      {
        id: 'mcp-1',
        name: 'Filesystem MCP',
        description: '文件访问',
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem']
        },
        configOverride: {
          command: 'node'
        },
        resolved: {
          type: 'stdio',
          command: 'node',
          args: []
        },
        order: 0
      }
    ],
    rules: []
  };
}

function createFormValues(
  overrides?: Partial<CreateSessionFormValues>
): CreateSessionFormValues {
  return {
    runnerId: 'runner-1',
    profileId: '',
    skillIds: ['skill-1'],
    ruleIds: [],
    mcpIds: ['mcp-1'],
    runnerSessionConfig: {
      temperature: '0.2'
    },
    initialMessageText: '请总结这个仓库',
    initialInputConfig: {
      tone: 'brief'
    },
    initialRuntimeConfig: {
      locale: 'zh-CN'
    },
    initialRawInput: '',
    ...overrides
  };
}

function createSupportedSchema(
  fields: NonNullable<Extract<SupportedRunnerConfigSchema, { supported: true }>['fields']>
): Extract<SupportedRunnerConfigSchema, { supported: true }> {
  const schema = parseRunnerConfigSchema({ fields });

  if (!schema.supported) {
    throw new Error('Expected supported schema');
  }

  return schema;
}

describe('useCreateSessionMutation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应构造规范的创建 payload，并在成功后写入缓存和触发 onCreated', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onCreated = vi.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    vi.mocked(createChat).mockResolvedValue(createChatSummary());

    const { result } = renderHook(() => {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: createFormValues()
      });

      return {
        form,
        mutation: useCreateSessionMutation({
          projectId: 'project-1',
          form,
          sessionConfigSchema: createSupportedSchema([
            {
              name: 'temperature',
              label: 'Temperature',
              kind: 'number',
              required: false
            }
          ]),
          structuredInputSchema: createSupportedSchema([
            {
              name: 'prompt',
              label: 'Prompt',
              kind: 'string',
              required: true
            },
            {
              name: 'tone',
              label: 'Tone',
              kind: 'string',
              required: false
            }
          ]),
          structuredRuntimeSchema: createSupportedSchema([
            {
              name: 'locale',
              label: 'Locale',
              kind: 'string',
              required: false
            }
          ]),
          primaryInputField: {
            name: 'prompt',
            label: 'Prompt',
            kind: 'string',
            required: true
          },
          supportsStructuredInitialInput: true,
          profileDetail: createProfileDetail(),
          onCreated
        })
      };
    }, { wrapper });

    await result.current.mutation.mutateAsync(result.current.form.getValues());

    expect(createChat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createChat).mock.calls[0]?.[0]).toEqual({
      scopeId: 'project-1',
      runnerId: 'runner-1',
      skillIds: ['skill-1'],
      ruleIds: [],
      mcps: [
        {
          resourceId: 'mcp-1',
          configOverride: {
            command: 'node'
          }
        }
      ],
      runnerSessionConfig: {
        temperature: 0.2
      },
      initialMessage: {
        input: {
          prompt: '请总结这个仓库',
          tone: 'brief'
        },
        runtimeConfig: {
          locale: 'zh-CN'
        }
      }
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chats.list('project-1')
      });
      expect(
        queryClient.getQueryData(queryKeys.chats.detail('chat-1'))
      ).toEqual(createChatSummary());
      expect(onCreated).toHaveBeenCalledWith(createChatSummary());
    });
  });

  it('Session 配置校验失败时，应写入表单错误并阻止调用 createChat', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: createFormValues({
          runnerSessionConfig: {
            temperature: 'not-a-number'
          }
        })
      });

      return {
        form,
        mutation: useCreateSessionMutation({
          projectId: 'project-1',
          form,
          sessionConfigSchema: createSupportedSchema([
            {
              name: 'temperature',
              label: 'Temperature',
              kind: 'number',
              required: false
            }
          ]),
          structuredInputSchema: undefined,
          structuredRuntimeSchema: undefined,
          primaryInputField: undefined,
          supportsStructuredInitialInput: false,
          profileDetail: undefined,
          onCreated: vi.fn()
        })
      };
    }, { wrapper });

    await expect(
      result.current.mutation.mutateAsync(result.current.form.getValues())
    ).rejects.toThrow('Session 配置校验失败');

    await waitFor(() => {
      expect(createChat).not.toHaveBeenCalled();
      expect(
        result.current.form.getFieldState('runnerSessionConfig.temperature')
          .error?.message
      ).toBeTruthy();
    });
  });

  it('raw-json 首条消息不是有效 JSON 时，应写入 initialRawInput 错误并阻止创建', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: createFormValues({
          initialMessageText: '',
          initialRawInput: '{invalid'
        })
      });

      return {
        form,
        mutation: useCreateSessionMutation({
          projectId: 'project-1',
          form,
          sessionConfigSchema: createSupportedSchema([]),
          structuredInputSchema: undefined,
          structuredRuntimeSchema: undefined,
          primaryInputField: undefined,
          supportsStructuredInitialInput: false,
          profileDetail: undefined,
          onCreated: vi.fn()
        })
      };
    }, { wrapper });

    await expect(
      result.current.mutation.mutateAsync(result.current.form.getValues())
    ).rejects.toThrow('首条消息输入校验失败');

    await waitFor(() => {
      expect(createChat).not.toHaveBeenCalled();
      expect(result.current.form.getFieldState('initialRawInput').error?.message)
        .toBe('消息输入不是有效的 JSON。');
    });
  });

  it('raw-json 运行时参数校验失败时，应把错误挂到对应 runtime 字段', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => {
      const form = useForm<CreateSessionFormValues>({
        defaultValues: createFormValues({
          initialMessageText: '',
          initialRawInput: '{ "prompt": "hello" }',
          initialRuntimeConfig: {
            maxTurns: 'oops'
          }
        })
      });

      return {
        form,
        mutation: useCreateSessionMutation({
          projectId: 'project-1',
          form,
          sessionConfigSchema: createSupportedSchema([]),
          structuredInputSchema: undefined,
          structuredRuntimeSchema: createSupportedSchema([
            {
              name: 'maxTurns',
              label: '最大轮次',
              kind: 'integer',
              required: false
            }
          ]),
          primaryInputField: undefined,
          supportsStructuredInitialInput: false,
          profileDetail: undefined,
          onCreated: vi.fn()
        })
      };
    }, { wrapper });

    await expect(
      result.current.mutation.mutateAsync(result.current.form.getValues())
    ).rejects.toThrow('首条消息运行时参数校验失败');

    await waitFor(() => {
      expect(createChat).not.toHaveBeenCalled();
      expect(
        result.current.form.getFieldState('initialRuntimeConfig.maxTurns').error
          ?.message
      ).toBe('Invalid input: expected number, received string');
    });
  });
});
