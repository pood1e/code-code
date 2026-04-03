import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceByKind } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';

import { getResource, saveResourceByKind } from '@/api/resources';
import { useErrorMessage } from '@/hooks/use-error-message';
import { renderWithProviders } from '@/test/render';

import { ResourceEditPage } from './ResourceEditPage';

vi.mock('@/api/resources', () => ({
  getResource: vi.fn(),
  saveResourceByKind: {
    skills: vi.fn(),
    mcps: vi.fn(),
    rules: vi.fn()
  }
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('@/components/JsonEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    readOnly,
    mode = 'json'
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    mode?: 'json' | 'markdown';
  }) => (
    <textarea
      aria-label={mode === 'markdown' ? 'Content' : 'JSON'}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
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
      aria-label="JSON"
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

function createSkillResource(): ResourceByKind['skills'] {
  return {
    id: 'skill-1',
    name: 'Review Skill',
    description: '代码审查',
    content: '# Skill',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function createMcpResource(): ResourceByKind['mcps'] {
  return {
    id: 'mcp-1',
    name: 'Filesystem MCP',
    description: '文件系统访问',
    content: {
      type: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      env: {
        ROOT: '/workspace'
      }
    },
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderResourceEditPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/skills/new"
        element={
          <>
            <ResourceEditPage kind="skills" />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/skills/:id/edit"
        element={
          <>
            <ResourceEditPage kind="skills" />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/mcps/new"
        element={
          <>
            <ResourceEditPage kind="mcps" />
            <RouteEcho />
          </>
        }
      />
      <Route
        path="/mcps/:id/edit"
        element={
          <>
            <ResourceEditPage kind="mcps" />
            <RouteEcho />
          </>
        }
      />
      <Route path="/skills" element={<RouteEcho />} />
      <Route path="/mcps" element={<RouteEcho />} />
    </Routes>,
    {
      route
    }
  );
}

describe('ResourceEditPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
  });

  it('新建 Skill 时应保存表单内容并返回列表页', async () => {
    vi.mocked(saveResourceByKind.skills).mockResolvedValue({
      ...createSkillResource(),
      name: 'New Skill',
      description: '新描述',
      content: '# New Skill'
    });

    const { user } = renderResourceEditPage('/skills/new');

    expect(screen.getByLabelText('Name')).toHaveFocus();

    await user.type(screen.getByLabelText('Name'), 'New Skill');
    await user.type(screen.getByLabelText('Description'), '新描述');
    await user.type(screen.getByLabelText('Content'), '# New Skill');

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(saveResourceByKind.skills).toHaveBeenCalledTimes(1);
      expect(vi.mocked(saveResourceByKind.skills).mock.calls[0]?.[0]).toEqual({
        name: 'New Skill',
        description: '新描述',
        content: '# New Skill'
      });
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/skills'
      );
    });
  });

  it('Content 为空时应展示字段校验错误，且不发送保存请求', async () => {
    const { user } = renderResourceEditPage('/skills/new');

    await user.type(screen.getByLabelText('Name'), 'New Skill');
    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    expect(await screen.findByText('Content is required')).toBeInTheDocument();
    expect(saveResourceByKind.skills).not.toHaveBeenCalled();
  });

  it('编辑不存在的 Skill 时应展示未找到空态，并可返回列表页', async () => {
    vi.mocked(getResource).mockRejectedValue(
      new ApiRequestError({
        code: 404,
        message: 'Skill not found',
        data: null
      })
    );

    const { user } = renderResourceEditPage('/skills/skill-missing/edit');

    expect(await screen.findByText('未找到 Skill')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回列表'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/skills'
    );
  });

  it('新建 MCP 时应支持编辑 env 与预览，并按结构化 payload 保存', async () => {
    vi.mocked(saveResourceByKind.mcps).mockResolvedValue(createMcpResource());

    const { user } = renderResourceEditPage('/mcps/new');

    expect(screen.getByLabelText('Name')).toHaveFocus();

    await user.click(screen.getByLabelText('Name'));
    await user.paste('Filesystem MCP');
    await user.click(screen.getByLabelText('Description'));
    await user.paste('文件系统访问');
    await user.click(screen.getByLabelText('Command'));
    await user.paste('npx');
    await user.click(screen.getByLabelText('Args'));
    await user.paste(
      '@modelcontextprotocol/server-filesystem\n--allow-write'
    );

    await user.click(
      screen.getByRole('button', {
        name: '添加环境变量'
      })
    );

    const envKeyInput = screen.getByPlaceholderText('KEY');
    const envValueInput = screen.getByPlaceholderText('VALUE');
    await user.click(envKeyInput);
    await user.paste('ROOT');
    await user.click(envValueInput);
    await user.paste('/workspace');

    expect(screen.getByLabelText('JSON')).toHaveValue(
      JSON.stringify(
        {
          type: 'stdio',
          command: 'npx',
          args: [
            '@modelcontextprotocol/server-filesystem',
            '--allow-write'
          ],
          env: {
            ROOT: '/workspace'
          }
        },
        null,
        2
      )
    );

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(saveResourceByKind.mcps).toHaveBeenCalledTimes(1);
      expect(vi.mocked(saveResourceByKind.mcps).mock.calls[0]?.[0]).toEqual({
        name: 'Filesystem MCP',
        description: '文件系统访问',
        content: {
          type: 'stdio',
          command: 'npx',
          args: [
            '@modelcontextprotocol/server-filesystem',
            '--allow-write'
          ],
          env: {
            ROOT: '/workspace'
          }
        }
      });
      expect(screen.getByLabelText('current-route')).toHaveTextContent('/mcps');
    });
  });

  it('编辑 MCP 时应回填表单，可移除 env 并按当前结构保存', async () => {
    vi.mocked(getResource).mockResolvedValue(createMcpResource());
    vi.mocked(saveResourceByKind.mcps).mockResolvedValue(createMcpResource());

    const { user } = renderResourceEditPage('/mcps/mcp-1/edit');

    expect(await screen.findByDisplayValue('Filesystem MCP')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('文件系统访问');
    expect(screen.getByLabelText('Command')).toHaveValue('npx');
    expect(screen.getByLabelText('Args')).toHaveValue(
      '@modelcontextprotocol/server-filesystem'
    );
    expect(screen.getByPlaceholderText('KEY')).toHaveValue('ROOT');
    expect(screen.getByPlaceholderText('VALUE')).toHaveValue('/workspace');

    await user.click(
      screen.getByRole('button', {
        name: '移除环境变量 1'
      })
    );

    expect(screen.getByText('暂无环境变量。')).toBeInTheDocument();
    expect(screen.getByLabelText('JSON')).toHaveValue(
      JSON.stringify(
        {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem']
        },
        null,
        2
      )
    );

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveResourceByKind.mcps).toHaveBeenCalledTimes(1);
      expect(vi.mocked(saveResourceByKind.mcps).mock.calls[0]?.[0]).toEqual({
        name: 'Filesystem MCP',
        description: '文件系统访问',
        content: {
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem']
        }
      });
      expect(vi.mocked(saveResourceByKind.mcps).mock.calls[0]?.[1]).toBe(
        'mcp-1'
      );
      expect(screen.getByLabelText('current-route')).toHaveTextContent('/mcps');
    });
  });

  it('点击返回应回到资源列表页', async () => {
    const { user } = renderResourceEditPage('/mcps/new');

    expect(screen.getByLabelText('Name')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.getByLabelText('current-route')).toHaveTextContent('/mcps');
  });

  it('保存 Skill 失败时应交给 useErrorMessage 处理，且不跳转', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(saveResourceByKind.skills).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'save failed',
        data: null
      })
    );

    const { user } = renderResourceEditPage('/skills/new');

    await user.type(screen.getByLabelText('Name'), 'Broken Skill');
    await user.type(screen.getByLabelText('Content'), '# Broken Skill');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/skills/new'
      );
    });
  });

  it('编辑 Skill 时查询失败应展示默认表单并上报错误', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(getResource).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'query failed',
        data: null
      })
    );

    renderResourceEditPage('/skills/skill-1/edit');

    expect(await screen.findByLabelText('Name')).toHaveValue('');

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError.mock.calls[0]?.[0]).toMatchObject({
        message: 'query failed'
      });
    });
  });
});
