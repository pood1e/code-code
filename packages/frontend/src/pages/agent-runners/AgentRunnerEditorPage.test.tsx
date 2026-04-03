import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentRunnerDetail,
  RunnerTypeResponse
} from '@agent-workbench/shared';

import {
  createAgentRunner,
  getAgentRunner,
  listAgentRunnerTypes,
  updateAgentRunner
} from '@/api/agent-runners';
import { ApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { renderWithProviders } from '@/test/render';

import { AgentRunnerEditorPage } from './AgentRunnerEditorPage';

vi.mock('@/api/agent-runners', () => ({
  createAgentRunner: vi.fn(),
  getAgentRunner: vi.fn(),
  listAgentRunnerTypes: vi.fn(),
  updateAgentRunner: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('@/components/JsonEditor', () => ({
  JsonEditor: ({
    value,
    onChange,
    readOnly
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Runner Config JSON"
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

const timestamp = '2026-04-03T10:00:00.000Z';

function createRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner Type',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: {
      fields: [
        {
          name: 'model',
          label: 'Model',
          kind: 'string',
          required: true,
          defaultValue: 'qwen3'
        }
      ]
    },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function createEndpointRunnerType(): RunnerTypeResponse {
  return {
    id: 'http',
    name: 'HTTP Runner Type',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: {
      fields: [
        {
          name: 'endpoint',
          label: 'Endpoint',
          kind: 'url',
          required: true,
          defaultValue: 'https://api.example.com'
        }
      ]
    },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function createEmptyRunnerType(): RunnerTypeResponse {
  return {
    id: 'empty',
    name: 'Empty Runner Type',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: {
      fields: []
    },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function createAgentRunnerDetail(): AgentRunnerDetail {
  return {
    id: 'runner-1',
    name: 'Mock Runner',
    description: '本地 Runner',
    type: 'mock',
    runnerConfig: {
      model: 'qwen3'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderAgentRunnerEditorPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/agent-runners/new"
        element={
          <>
            <AgentRunnerEditorPage />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/agent-runners/:id/edit"
        element={
          <>
            <AgentRunnerEditorPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/agent-runners" element={<RouteEcho />} />
    </Routes>,
    {
      route
    }
  );
}

describe('AgentRunnerEditorPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([createRunnerType()]);
  });

  it('新建 AgentRunner 时应按 RunnerType schema 提交结构化 runnerConfig', async () => {
    vi.mocked(createAgentRunner).mockResolvedValue({
      ...createAgentRunnerDetail(),
      name: 'Qwen Runner'
    });

    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'Qwen Runner');

    const modelInput = screen.getByLabelText('Model');
    await user.clear(modelInput);
    await user.type(modelInput, 'qwen3-coder');

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(createAgentRunner).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createAgentRunner).mock.calls[0]?.[0]).toEqual({
        name: 'Qwen Runner',
        description: undefined,
        type: 'mock',
        runnerConfig: {
          model: 'qwen3-coder'
        }
      });
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/agent-runners'
      );
    });
  });

  it('编辑不存在的 AgentRunner 时应展示未找到空态，并可返回列表页', async () => {
    vi.mocked(getAgentRunner).mockRejectedValue(
      new ApiRequestError({
        code: 404,
        message: 'runner not found',
        data: null
      })
    );

    const { user } = renderAgentRunnerEditorPage(
      '/agent-runners/runner-missing/edit'
    );

    expect(await screen.findByText('未找到 AgentRunner')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回列表'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/agent-runners'
    );
  });

  it('没有 RunnerType 时应展示空态，并可返回列表页', async () => {
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([]);

    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    expect(await screen.findByText('暂无 Runner Type')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回列表'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/agent-runners'
    );
  });

  it('编辑已有 AgentRunner 时应锁定 Type 并调用 update 接口', async () => {
    vi.mocked(getAgentRunner).mockResolvedValue(createAgentRunnerDetail());
    vi.mocked(updateAgentRunner).mockResolvedValue({
      ...createAgentRunnerDetail(),
      name: 'Renamed Runner'
    });

    const { user } = renderAgentRunnerEditorPage(
      '/agent-runners/runner-1/edit'
    );

    const typeInput = await screen.findByLabelText('Type');
    expect(typeInput).toBeDisabled();
    expect(typeInput).toHaveValue('Mock Runner Type');

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Runner');

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(updateAgentRunner).toHaveBeenCalledTimes(1);
      expect(vi.mocked(updateAgentRunner).mock.calls[0]?.[0]).toBe('runner-1');
      expect(vi.mocked(updateAgentRunner).mock.calls[0]?.[1]).toEqual({
        name: 'Renamed Runner',
        description: '本地 Runner',
        runnerConfig: {
          model: 'qwen3'
        }
      });
    });
  });

  it('RunnerTypes 加载失败时应上报错误并展示重试空态', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listAgentRunnerTypes).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'runner types failed',
        data: null
      })
    );

    renderAgentRunnerEditorPage('/agent-runners/new');

    expect(await screen.findByText('无法加载 Runner Types')).toBeInTheDocument();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'runner types failed'
      });
    });
  });

  it('RunnerTypes 加载失败时点击重试，应重新请求 RunnerTypes', async () => {
    vi.mocked(listAgentRunnerTypes).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'runner types failed',
        data: null
      })
    );

    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    expect(await screen.findByText('无法加载 Runner Types')).toBeInTheDocument();
    expect(listAgentRunnerTypes).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => {
      expect(listAgentRunnerTypes).toHaveBeenCalledTimes(2);
    });
  });

  it('结构化字段校验失败时应显示字段错误且不提交', async () => {
    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'Qwen Runner');

    const modelInput = screen.getByLabelText('Model');
    await user.clear(modelInput);

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('Model 为必填项')).toBeInTheDocument();
    expect(createAgentRunner).not.toHaveBeenCalled();
  });

  it('保存失败时应显示就地错误并停留在当前页', async () => {
    vi.mocked(createAgentRunner).mockRejectedValue(new Error('save failed'));

    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'Qwen Runner');
    const modelInput = screen.getByLabelText('Model');
    await user.clear(modelInput);
    await user.type(modelInput, 'qwen3-coder');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存失败')).toBeInTheDocument();
    expect(screen.getByText('save failed')).toBeInTheDocument();
    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/agent-runners/new'
    );
  });

  it('切换 RunnerType 时应重置旧类型字段，并展示新类型默认配置', async () => {
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([
      createRunnerType(),
      createEndpointRunnerType()
    ]);

    const { user } = renderAgentRunnerEditorPage('/agent-runners/new');

    const modelInput = await screen.findByLabelText('Model');
    expect(modelInput).toHaveValue('qwen3');

    await user.selectOptions(screen.getByLabelText('Type'), 'http');

    await waitFor(() => {
      expect(screen.queryByLabelText('Model')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Endpoint')).toHaveValue(
        'https://api.example.com'
      );
    });
  });

  it('当前 RunnerType 没有可编辑字段时，应展示空字段提示', async () => {
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([createEmptyRunnerType()]);

    renderAgentRunnerEditorPage('/agent-runners/new');

    expect(
      await screen.findByText('当前类型没有可编辑字段')
    ).toBeInTheDocument();
    expect(
      screen.getByText('该 RunnerType 的 L1 配置为空，保存时将提交空对象。')
    ).toBeInTheDocument();
  });
});
