import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { AgentRunnerSummary, RunnerTypeResponse } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import {
  deleteAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useUiStore } from '@/store/ui-store';
import { renderWithProviders } from '@/test/render';

import { AgentRunnerListPage } from './AgentRunnerListPage';

vi.mock('@/api/agent-runners', () => ({
  deleteAgentRunner: vi.fn(),
  listAgentRunners: vi.fn(),
  listAgentRunnerTypes: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

function createAgentRunner(): AgentRunnerSummary {
  return {
    id: 'runner-1',
    name: 'Mock Runner',
    description: '本地测试 Runner',
    type: 'mock',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createRunnerType(): RunnerTypeResponse {
  return {
    id: 'mock',
    name: 'Mock Runner Type',
    capabilities: {
      skill: false,
      rule: false,
      mcp: false
    },
    runnerConfigSchema: { fields: [] },
    runnerSessionConfigSchema: { fields: [] },
    inputSchema: { fields: [] },
      runtimeConfigSchema: { fields: [] }
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderAgentRunnerListPage(route = '/agent-runners') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/agent-runners"
        element={
          <>
            <AgentRunnerListPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/agent-runners/new" element={<RouteEcho />} />
      <Route
        path="/agent-runners/:runnerId/edit"
        element={<RouteEcho />}
      />
    </Routes>,
    {
      route
    }
  );
}

describe('AgentRunnerListPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    vi.mocked(listAgentRunnerTypes).mockResolvedValue([createRunnerType()]);
    useUiStore.setState({
      agentRunnerSearch: ''
    });
  });

  it('空列表时应展示空态，并可进入新建页', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([]);

    const { user } = renderAgentRunnerListPage();

    expect(await screen.findByText('暂无 AgentRunners')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '新建 AgentRunner'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/agent-runners/new'
    );
  });

  it('有数据时应展示 RunnerType 名称，点击名称进入编辑页', async () => {
    vi.mocked(listAgentRunners)
      .mockResolvedValueOnce([createAgentRunner()])
      .mockResolvedValueOnce([]);
    vi.mocked(deleteAgentRunner).mockResolvedValue(null);

    const { user } = renderAgentRunnerListPage();

    expect(await screen.findByText('Mock Runner Type')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Mock Runner'
      })
    );
    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/agent-runners/runner-1/edit'
    );
  });

  it('确认删除 AgentRunner 后应关闭确认弹窗', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);
    vi.mocked(deleteAgentRunner).mockResolvedValue(null);

    const { user } = renderAgentRunnerListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Mock Runner'
      })
    );
    expect(screen.getByText('删除 Mock Runner？')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '删除'
      })
    );

    await waitFor(() => {
      expect(deleteAgentRunner).toHaveBeenCalledTimes(1);
      expect(vi.mocked(deleteAgentRunner).mock.calls[0]?.[0]).toBe('runner-1');
      expect(screen.queryByText('删除 Mock Runner？')).not.toBeInTheDocument();
    });
  });

  it('Runner 列表查询失败时应通过 useErrorMessage 上报', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listAgentRunners).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'runner list failed',
        data: null
      })
    );

    renderAgentRunnerListPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'runner list failed'
      });
    });
  });

  it('删除 AgentRunner 失败时应通过 useErrorMessage 上报', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);
    vi.mocked(deleteAgentRunner).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderAgentRunnerListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Mock Runner'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));

    expect(await screen.findByText('delete failed')).toBeInTheDocument();
    expect(screen.getByText('删除 Mock Runner？')).toBeInTheDocument();
  });

  it('有搜索词但结果为空时，仍应展示搜索工具栏', async () => {
    useUiStore.setState({
      agentRunnerSearch: 'Mock'
    });
    vi.mocked(listAgentRunners).mockResolvedValue([]);

    renderAgentRunnerListPage();

    expect(await screen.findByPlaceholderText('按名称搜索')).toHaveValue('Mock');
    expect(
      screen.getByRole('button', { name: '刷新 AgentRunners' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '新建 AgentRunner' })
    ).toBeInTheDocument();
  });

  it('点击刷新时应重新请求 Runner 列表', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);

    const { user } = renderAgentRunnerListPage();

    await screen.findByText('Mock Runner Type');
    expect(listAgentRunners).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getByRole('button', { name: '刷新 AgentRunners' })
    );

    await waitFor(() => {
      expect(listAgentRunners).toHaveBeenCalledTimes(2);
    });
  });

  it('RunnerTypes 查询失败时应通过 useErrorMessage 上报', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listAgentRunnerTypes).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'runner types failed',
        data: null
      })
    );
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);

    renderAgentRunnerListPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'runner types failed'
      });
    });
  });

  it('删除进行中时确认弹窗按钮应禁用，避免重复提交', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);
    vi.mocked(deleteAgentRunner).mockImplementation(
      () => new Promise(() => undefined)
    );

    const { user } = renderAgentRunnerListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Mock Runner'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '删除' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    });
  });

  it('删除错误在关闭确认弹窗后应被清空', async () => {
    vi.mocked(listAgentRunners).mockResolvedValue([createAgentRunner()]);
    vi.mocked(deleteAgentRunner).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'delete failed',
        data: null
      })
    );

    const { user } = renderAgentRunnerListPage();

    await user.click(
      await screen.findByRole('button', {
        name: '删除 Mock Runner'
      })
    );
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(await screen.findByText('delete failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(
      screen.getByRole('button', {
        name: '删除 Mock Runner'
      })
    );

    expect(screen.queryByText('delete failed')).not.toBeInTheDocument();
  });
});
