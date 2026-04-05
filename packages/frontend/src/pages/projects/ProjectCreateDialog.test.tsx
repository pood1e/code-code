import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@agent-workbench/shared';

import { ApiRequestError } from '@/api/client';
import { createProject } from '@/api/projects';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { renderWithProviders } from '@/test/render';

import { ProjectCreateDialog } from './ProjectCreateDialog';

vi.mock('@/api/projects', () => ({
  createProject: vi.fn()
}));

const handleErrorMock = vi.fn();

vi.mock('@/hooks/use-error-message', () => ({
  useErrorMessage: () => handleErrorMock
}));

function createProjectRecord(): Project {
  return {
    id: 'project-1',
    name: 'Workbench',
    description: 'Agent workbench project',
    gitUrl: 'git@github.com:acme/workbench.git',
    workspacePath: '/tmp/workbench',
    docSource: '/tmp/docs',
    createdAt: '2026-04-03T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z'
  };
}

function renderControlledProjectCreateDialog(onOpenChange = vi.fn()) {
  function ControlledDialog() {
    const [open, setOpen] = useState(true);

    return (
      <>
        <ProjectCreateDialog
          open={open}
          onOpenChange={(nextOpen) => {
            onOpenChange(nextOpen);
            setOpen(nextOpen);
          }}
        />
        <button type="button" onClick={() => setOpen(true)}>
          重新打开
        </button>
      </>
    );
  }

  return renderWithProviders(<ControlledDialog />);
}

describe('ProjectCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleErrorMock.mockReset();
    useProjectStore.setState({ currentProjectId: null });
  });

  it('应校验必填字段，名称为空时不调用创建 API', async () => {
    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(
      await screen.findByText('Project 名称不能为空')
    ).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('提交成功后应关闭弹窗、缓存详情并设置当前 Project', async () => {
    vi.mocked(createProject).mockResolvedValue(createProjectRecord());
    const onOpenChange = vi.fn();

    const { user, queryClient } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={onOpenChange} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Description'),
      'Agent workbench project'
    );
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(
      screen.getByLabelText('Workspace Path'),
      '/tmp/workbench'
    );
    await user.type(screen.getByLabelText('文档地址'), '/tmp/docs');
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(createProject).mock.calls[0]?.[0]).toEqual({
        name: 'Workbench',
        description: 'Agent workbench project',
        gitUrl: 'git@github.com:acme/workbench.git',
        workspacePath: '/tmp/workbench',
        docSource: '/tmp/docs'
      });

    expect(queryClient.getQueryData(queryKeys.projects.detail('project-1'))).toEqual(
      createProjectRecord()
    );
    expect(useProjectStore.getState().currentProjectId).toBe('project-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('后端返回 gitUrl 400 错误时应展示字段错误和顶部错误提示', async () => {
    vi.mocked(createProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: '请输入合法的 SSH Git 地址，如 git@github.com:user/repo.git',
        data: null
      })
    );

    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(screen.getByLabelText('Git URL'), 'https://github.com/acme/repo');
    await user.type(
      screen.getByLabelText('Workspace Path'),
      '/tmp/workbench'
    );
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(
      await screen.findAllByText(
        '请输入合法的 SSH Git 地址，如 git@github.com:user/repo.git'
      )
    ).toHaveLength(1);
    expect(screen.queryByText('创建失败')).not.toBeInTheDocument();
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it('后端返回 workspacePath 400 错误时应展示表单错误和顶部错误提示', async () => {
    vi.mocked(createProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: 'workspacePath 目录不存在',
        data: null
      })
    );

    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(screen.getByLabelText('Workspace Path'), '/bad/path');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(
      await screen.findAllByText('workspacePath 目录不存在')
    ).toHaveLength(2);
    expect(screen.getByText('创建失败')).toBeInTheDocument();
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it('后端返回 docSource 400 错误时应展示文档地址字段错误', async () => {
    vi.mocked(createProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: 'docSource does not exist or is not a directory',
        data: null
      })
    );

    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(screen.getByLabelText('Workspace Path'), '/tmp/workbench');
    await user.type(screen.getByLabelText('文档地址'), '/bad/docs');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(
      await screen.findAllByText(
        'docSource does not exist or is not a directory'
      )
    ).toHaveLength(2);
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it('未知错误应展示失败提示并交给 useErrorMessage', async () => {
    vi.mocked(createProject).mockRejectedValue(
      new ApiRequestError({
        code: 500,
        message: 'Server exploded',
        data: null
      })
    );

    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(
      screen.getByLabelText('Workspace Path'),
      '/tmp/workbench'
    );
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
  });

  it('关闭后重新打开应清空表单和错误状态', async () => {
    vi.mocked(createProject).mockRejectedValue(
      new ApiRequestError({
        code: 400,
        message: 'workspacePath 目录不存在',
        data: null
      })
    );
    const onOpenChange = vi.fn();

    const { user } = renderControlledProjectCreateDialog(onOpenChange);

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(screen.getByLabelText('Workspace Path'), '/bad/path');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByText('创建失败')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '重新打开' }));

    expect(screen.queryByText('创建失败')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Git URL')).toHaveValue('');
    expect(screen.getByLabelText('Workspace Path')).toHaveValue('');
  });

  it('点击取消应关闭弹窗并立即清空本地表单状态', async () => {
    const onOpenChange = vi.fn();

    const { user } = renderControlledProjectCreateDialog(onOpenChange);

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Workspace Path'),
      '/tmp/workbench'
    );
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: '重新打开' }));

    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Workspace Path')).toHaveValue('');
  });

  it('创建进行中应禁用取消和创建按钮', async () => {
    let resolveProject: ((value: Project) => void) | undefined;
    vi.mocked(createProject).mockImplementation(
      () =>
        new Promise<Project>((resolve) => {
          resolveProject = resolve;
        })
    );

    const { user } = renderWithProviders(
      <ProjectCreateDialog open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Name'), 'Workbench');
    await user.type(
      screen.getByLabelText('Git URL'),
      'git@github.com:acme/workbench.git'
    );
    await user.type(
      screen.getByLabelText('Workspace Path'),
      '/tmp/workbench'
    );
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();

    resolveProject?.(createProjectRecord());
    await waitFor(() => {
      expect(createProject).toHaveBeenCalledTimes(1);
    });
  });

  it('打开弹窗时应自动聚焦到名称输入框', () => {
    renderWithProviders(<ProjectCreateDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveFocus();
  });
});
