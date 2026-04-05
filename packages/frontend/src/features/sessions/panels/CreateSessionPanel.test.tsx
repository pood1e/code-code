import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentRunnerSummary,
  ChatSummary,
  Profile,
  ResourceByKind,
  RunnerTypeResponse
} from '@agent-workbench/shared';
import { SessionStatus } from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { getProfile } from '@/api/profiles';
import { useErrorMessage } from '@/hooks/use-error-message';
import { renderWithProviders } from '@/test/render';

import { CreateSessionPanel } from './CreateSessionPanel';

const createSessionMutationMock = vi.hoisted(() => ({
  isPending: false,
  mutateAsync: vi.fn()
}));

vi.mock('@/api/agent-runners', async () => ({
  probeAgentRunnerContext: vi.fn()
}));

vi.mock('@/api/profiles', () => ({
  getProfile: vi.fn()
}));

const handleErrorMock = vi.fn();

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => handleErrorMock
}));

vi.mock('../hooks/use-create-session-mutation', () => ({
  useCreateSessionMutation: () => createSessionMutationMock
}));

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
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        }
      ]
    },
    runtimeConfigSchema: { fields: [] }
  };
}

function createRawJsonRunnerType(): RunnerTypeResponse {
  return {
    ...createRunnerType(),
    inputSchema: { fields: [] },
    runtimeConfigSchema: {
      fields: [
        {
          name: 'model',
          label: '模型',
          kind: 'string',
          required: false
        }
      ]
    }
  };
}

function createQwenRunnerType(): RunnerTypeResponse {
  return {
    ...createRunnerType(),
    id: 'qwen-cli',
    name: 'Qwen CLI',
    runtimeConfigSchema: {
      fields: [
        {
          name: 'approvalMode',
          label: '审批模式',
          kind: 'enum',
          required: false,
          enumOptions: [
            { label: '计划', value: 'plan' },
            { label: '默认', value: 'default' },
            { label: '自动编辑', value: 'auto-edit' },
            { label: 'YOLO', value: 'yolo' }
          ]
        }
      ]
    }
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

function createRunnerWithType(
  id: string,
  name: string,
  type: string
): AgentRunnerSummary {
  return {
    id,
    name,
    description: null,
    type,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createStructuredRunnerTypeWithAdvancedFields(): RunnerTypeResponse {
  return {
    ...createRunnerType(),
    id: 'structured',
    name: 'Structured Runner',
    runnerSessionConfigSchema: {
      fields: [
        {
          name: 'sandbox',
          label: '沙箱',
          kind: 'boolean',
          required: false
        }
      ]
    },
    inputSchema: {
      fields: [
        {
          name: 'prompt',
          label: 'Prompt',
          kind: 'string',
          required: true
        },
        {
          name: 'tone',
          label: '语气',
          kind: 'string',
          required: false
        }
      ]
    }
  };
}

function createProfile(): Profile {
  return {
    id: 'profile-1',
    name: '默认 Profile',
    description: null,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createSkill(id: string, name: string): ResourceByKind['skills'] {
  return {
    id,
    name,
    description: `${name} description`,
    content: `${name} content`,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRule(id: string, name: string): ResourceByKind['rules'] {
  return {
    id,
    name,
    description: `${name} description`,
    content: `${name} content`,
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createMcp(id: string, name: string): ResourceByKind['mcps'] {
  return {
    id,
    name,
    description: `${name} description`,
    content: {
      type: 'stdio',
      command: 'node',
      args: ['server.js']
    },
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

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

function renderPanel({
  canCancel = true,
  onCancel = vi.fn(),
  onCreated = vi.fn(),
  runnerTypes = [createRunnerType()],
  runners = [createRunner()],
  profiles = [],
  resources = {
    skills: [],
    mcps: [],
    rules: []
  }
}: {
  canCancel?: boolean;
  onCancel?: () => void;
  onCreated?: (chat: ChatSummary) => void;
  runnerTypes?: RunnerTypeResponse[];
  runners?: AgentRunnerSummary[];
  profiles?: Profile[];
  resources?: {
    skills: ResourceByKind['skills'][];
    mcps: ResourceByKind['mcps'][];
    rules: ResourceByKind['rules'][];
  };
} = {}) {
  return renderWithProviders(
    <CreateSessionPanel
      projectId="project-1"
      runnerTypes={runnerTypes}
      runners={runners}
      profiles={profiles}
      resources={resources}
      canCancel={canCancel}
      onCancel={onCancel}
      onCreated={onCreated}
    />
  );
}

describe('CreateSessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleErrorMock.mockReset();
    createSessionMutationMock.isPending = false;
    createSessionMutationMock.mutateAsync.mockResolvedValue(
      createChatSummary()
    );
    vi.mocked(probeAgentRunnerContext).mockResolvedValue({});
    vi.mocked(getProfile).mockResolvedValue({
      id: 'profile-1',
      name: 'Default',
      description: null,
      createdAt: '2026-04-03T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z',
      skills: [],
      mcps: [],
      rules: []
    });
  });

  it('首条消息为空时应禁用发送按钮，输入后可点击发送', async () => {
    const { user } = renderPanel();

    const sendButton = screen.getByRole('button', { name: '发送' });
    expect(sendButton).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText('输入首条消息...'),
      'Hello session'
    );

    await waitFor(() => {
      expect(sendButton).toBeEnabled();
    });

    await user.click(sendButton);

    await waitFor(() => {
      expect(createSessionMutationMock.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          runnerId: 'runner-1',
          initialMessageText: 'Hello session'
        })
      );
    });
  });

  it('输入首条消息后按 Enter 应提交，Shift+Enter 不应提交', async () => {
    const { user } = renderPanel();
    const promptInput = screen.getByPlaceholderText('输入首条消息...');

    await user.type(promptInput, 'First line');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(createSessionMutationMock.mutateAsync).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(createSessionMutationMock.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('输入法组合输入时按 Enter 不应误提交', async () => {
    const { user } = renderPanel();
    const promptInput = screen.getByPlaceholderText('输入首条消息...');

    await user.type(promptInput, '你好');
    promptInput.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      })
    );
    Object.defineProperty(promptInput, 'value', {
      value: '你好',
      configurable: true
    });

    expect(createSessionMutationMock.mutateAsync).not.toHaveBeenCalled();
  });

  it('raw-json 模式下按 Enter 不应直接提交，应允许继续编辑 JSON', async () => {
    const { user } = renderPanel({
      runnerTypes: [createRawJsonRunnerType()]
    });
    const rawInput = screen.getByPlaceholderText(/"prompt"/);

    await user.type(rawInput, 'x');
    await user.keyboard('{Enter}');

    expect(createSessionMutationMock.mutateAsync).not.toHaveBeenCalled();
    expect(rawInput).toHaveValue('x\n');
  });

  it('应支持选择 Profile，并在工作区与资源区展示资源预填结果', async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: 'profile-1',
      name: 'Default',
      description: null,
      createdAt: '2026-04-03T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z',
      skills: [
        {
          id: 'skill-1',
          name: 'Skill One',
          description: null,
          content: 'Skill One content',
          resolved: 'Skill One content',
          order: 0
        }
      ],
      mcps: [
        {
          id: 'mcp-1',
          name: 'Filesystem MCP',
          description: null,
          content: {
            type: 'stdio',
            command: 'node',
            args: ['server.js']
          },
          configOverride: {},
          resolved: {
            type: 'stdio',
            command: 'node',
            args: ['server.js']
          },
          order: 0
        }
      ],
      rules: [
        {
          id: 'rule-1',
          name: 'Rule One',
          description: null,
          content: 'Rule One content',
          resolved: 'Rule One content',
          order: 0
        }
      ]
    });

    const { user } = renderPanel({
      runnerTypes: [createRawJsonRunnerType()],
      profiles: [createProfile()],
      resources: {
        skills: [createSkill('skill-1', 'Skill One')],
        rules: [createRule('rule-1', 'Rule One')],
        mcps: [createMcp('mcp-1', 'Filesystem MCP')]
      }
    });

    expect(screen.getByLabelText('模型')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '选择 Profile' }),
      'profile-1'
    );

    await waitFor(() => {
      expect(screen.getAllByText('Skill One').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rule One').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Filesystem MCP').length).toBeGreaterThan(0);
    });
  });

  it('Qwen 的 approvalMode 应作为下拉框渲染在运行参数里', async () => {
    const { user } = renderPanel({
      runnerTypes: [createQwenRunnerType()],
      runners: [createRunnerWithType('runner-qwen', 'Qwen Runner', 'qwen-cli')]
    });

    const approvalModeField = screen.getByRole('combobox', {
      name: '审批模式'
    });
    expect(approvalModeField).toBeInTheDocument();

    await user.selectOptions(approvalModeField, 'auto-edit');
    expect(approvalModeField).toHaveValue('auto-edit');
  });

  it('切换 AgentRunner 时应重置旧 runner 的草稿与 schema 字段', async () => {
    const { user } = renderPanel({
      runnerTypes: [
        createStructuredRunnerTypeWithAdvancedFields(),
        {
          ...createRawJsonRunnerType(),
          id: 'raw',
          name: 'Raw Runner'
        }
      ],
      runners: [
        createRunnerWithType(
          'runner-structured',
          'Structured Runner',
          'structured'
        ),
        createRunnerWithType('runner-raw', 'Raw Runner', 'raw')
      ]
    });

    await user.type(
      screen.getByPlaceholderText('输入首条消息...'),
      '要被重置的草稿'
    );
    expect(screen.getByLabelText('沙箱')).toBeInTheDocument();
    await user.click(screen.getByText('高级输入'));
    expect(screen.getByLabelText('语气')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: '选择 AgentRunner' }),
      'runner-raw'
    );

    await waitFor(() => {
      expect(screen.getByLabelText('首条消息 JSON')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/"prompt"/)).toHaveValue('');
      expect(screen.queryByLabelText('语气')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('沙箱')).not.toBeInTheDocument();
      expect(screen.getByLabelText('模型')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    });
  });

  it('首条消息运行时参数校验失败时，应只显示字段级错误，不显示顶层创建失败', async () => {
    createSessionMutationMock.mutateAsync.mockRejectedValueOnce(
      new Error('首条消息运行时参数校验失败')
    );

    const { user } = renderPanel({
      runnerTypes: [createRawJsonRunnerType()]
    });

    await user.click(screen.getByPlaceholderText(/"prompt"/));
    await user.paste('{"prompt":"hi"}');
    await user.type(screen.getByLabelText('模型'), 'bad-runtime');
    await user.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(createSessionMutationMock.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('创建失败')).not.toBeInTheDocument();
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it('可取消时应展示取消按钮并触发 onCancel', async () => {
    const onCancel = vi.fn();
    const { user } = renderPanel({ onCancel });

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('不可取消时不应展示取消按钮', () => {
    renderPanel({ canCancel: false });

    expect(
      screen.queryByRole('button', { name: '取消' })
    ).not.toBeInTheDocument();
  });

  it('创建失败时应展示顶层错误并交给 useErrorMessage', async () => {
    createSessionMutationMock.mutateAsync.mockRejectedValueOnce(
      new Error('Request failed')
    );

    const { user } = renderPanel();

    await user.type(
      screen.getByPlaceholderText('输入首条消息...'),
      'Hello session'
    );
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('创建失败')).toBeInTheDocument();
    expect(screen.getByText('Request failed')).toBeInTheDocument();
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
  });

  it('创建进行中应禁用发送按钮并显示加载图标', async () => {
    createSessionMutationMock.isPending = true;
    renderPanel();

    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('打开面板时应自动聚焦到首条消息输入框', () => {
    renderPanel();

    expect(screen.getByLabelText('首条消息')).toHaveFocus();
  });
});
