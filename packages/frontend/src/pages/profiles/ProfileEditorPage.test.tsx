import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  McpResource,
  ProfileDetail,
  RuleResource,
  SkillResource
} from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import { getProfile, saveProfile } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { useErrorMessage } from '@/hooks/use-error-message';
import { renderWithProviders } from '@/test/render';
import { toast } from 'sonner';

import { ProfileEditorPage } from './ProfileEditorPage';

vi.mock('@/api/profiles', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn()
}));

vi.mock('@/api/resources', () => ({
  listResources: vi.fn()
}));

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock('@/components/JsonEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    readOnly
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="MCP Override JSON"
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

const timestamp = '2026-04-03T10:00:00.000Z';

function createProfileDetail(): ProfileDetail {
  return {
    id: 'profile-1',
    name: 'Default Profile',
    description: '默认资源组合',
    createdAt: timestamp,
    updatedAt: timestamp,
    skills: [],
    mcps: [],
    rules: []
  };
}

function createSkillResource(): SkillResource {
  return {
    id: 'skill-1',
    name: 'Review Skill',
    description: '代码审查',
    content: '# Skill',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createMcpResource(): McpResource {
  return {
    id: 'mcp-1',
    name: 'Filesystem MCP',
    description: '文件访问',
    content: {
      type: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem']
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createRuleResource(): RuleResource {
  return {
    id: 'rule-1',
    name: 'Strict Rule',
    description: '严格约束',
    content: '# Rule',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function RouteEcho() {
  const location = useLocation();
  return <p aria-label="current-route">{location.pathname}</p>;
}

function renderProfileEditorPage(route = '/profiles/profile-1/edit') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/profiles/:id/edit"
        element={
          <>
            <ProfileEditorPage />
            <RouteEcho />
          </>
        }
      />
      <Route path="/profiles" element={<RouteEcho />} />
    </Routes>,
    {
      route
    }
  );
}

describe('ProfileEditorPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useErrorMessage).mockReturnValue(vi.fn());
    vi.mocked(getProfile).mockResolvedValue(createProfileDetail());
    vi.mocked(saveProfile).mockResolvedValue(createProfileDetail());
    vi.mocked(listResources).mockImplementation(async (kind) => {
      switch (kind) {
        case 'skills':
          return [createSkillResource()];
        case 'mcps':
          return [createMcpResource()];
        case 'rules':
          return [createRuleResource()];
      }
    });
  });

  it('应能添加 Skill 后保存 Profile，并返回列表页', async () => {
    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();

    await user.click(
      screen.getByRole('button', {
        name: '添加 Review Skill'
      })
    );

    await user.click(
      screen.getByRole('button', {
        name: '保存'
      })
    );

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledTimes(1);
      expect(vi.mocked(saveProfile).mock.calls[0]?.[0]).toBe('profile-1');
      expect(vi.mocked(saveProfile).mock.calls[0]?.[1]).toEqual({
        name: 'Default Profile',
        description: '默认资源组合',
        skills: [
          {
            resourceId: 'skill-1',
            order: 0
          }
        ],
        mcps: [],
        rules: []
      });
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/profiles'
      );
      expect(toast.success).toHaveBeenCalledWith('Profile 已保存');
    });
  });

  it('点击返回应回到 Profiles 列表页', async () => {
    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/profiles'
    );
  });

  it('Profile 不存在时应展示空态，并可返回 Profiles 列表页', async () => {
    vi.mocked(getProfile).mockRejectedValue(
      new ApiRequestError({
        code: 404,
        message: 'profile not found',
        data: null
      })
    );

    const { user } = renderProfileEditorPage('/profiles/profile-missing/edit');

    expect(await screen.findByText('未找到 Profile')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '返回 Profiles'
      })
    );

    expect(screen.getByLabelText('current-route')).toHaveTextContent(
      '/profiles'
    );
  });

  it('MCP override 非法时应阻止保存并提示用户修正 JSON', async () => {
    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '添加 Filesystem MCP'
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: '编辑 override'
      })
    );
    fireEvent.change(screen.getByLabelText('MCP Override JSON'), {
      target: { value: '{invalid}' }
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(saveProfile).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('请先修正 MCP override 的 JSON。');
  });

  it('应能保存带 MCP override 的 Profile', async () => {
    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '添加 Filesystem MCP'
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: '编辑 override'
      })
    );
    fireEvent.change(screen.getByLabelText('MCP Override JSON'), {
      target: {
        value: '{"command":"qwen-mcp","env":{"ROOT":"/workspace"}}'
      }
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledTimes(1);
      expect(vi.mocked(saveProfile).mock.calls[0]?.[1]).toEqual({
        name: 'Default Profile',
        description: '默认资源组合',
        skills: [],
        mcps: [
          {
            resourceId: 'mcp-1',
            order: 0,
            configOverride: {
              command: 'qwen-mcp',
              env: {
                ROOT: '/workspace'
              }
            }
          }
        ],
        rules: []
      });
    });
  });

  it('移除 MCP 时应清理 override 展开和错误状态', async () => {
    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '添加 Filesystem MCP'
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: '编辑 override'
      })
    );
    fireEvent.change(screen.getByLabelText('MCP Override JSON'), {
      target: { value: '{invalid}' }
    });

    expect(screen.getByText('Override must be valid JSON.')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: '移除 Filesystem MCP'
      })
    );

    expect(
      screen.queryByText('Override must be valid JSON.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '收起 override' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '添加 Filesystem MCP' })
    ).toBeInTheDocument();
  });

  it('资源目录查询失败时应上报错误并返回 Profiles 列表页', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(listResources).mockImplementation(async (kind) => {
      if (kind === 'mcps') {
        throw new ApiRequestError({
          code: 500,
          message: 'mcp list failed',
          data: null
        });
      }

      switch (kind) {
        case 'skills':
          return [createSkillResource()];
        case 'rules':
          return [createRuleResource()];
      }
    });

    renderProfileEditorPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/profiles'
      );
    });
  });

  it('Profile 查询失败时应上报错误并返回 Profiles 列表页', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(getProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'profile load failed',
        data: null
      })
    );

    renderProfileEditorPage();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/profiles'
      );
    });
  });

  it('保存失败时应上报错误并停留在编辑页', async () => {
    const handleError = vi.fn();
    vi.mocked(useErrorMessage).mockReturnValue(handleError);
    vi.mocked(saveProfile).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'save failed',
        data: null
      })
    );

    const { user } = renderProfileEditorPage();

    expect(await screen.findByDisplayValue('Default Profile')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('current-route')).toHaveTextContent(
        '/profiles/profile-1/edit'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
