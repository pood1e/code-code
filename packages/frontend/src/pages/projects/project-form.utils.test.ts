import { describe, expect, it } from 'vitest';

import {
  buildCreateProjectInput,
  buildProjectFormValues,
  buildUpdateProjectInput,
  createProjectFormSchema
} from './project-form.utils';

describe('project-form.utils', () => {
  it('buildProjectFormValues 应把 Project 映射为表单默认值，缺省时返回空表单', () => {
    expect(buildProjectFormValues()).toEqual({
      name: '',
      description: '',
      repoGitUrl: '',
      workspaceRootPath: '',
      docGitUrl: ''
    });

    expect(
      buildProjectFormValues({
        id: 'project-1',
        name: 'Workbench',
        description: null,
        repoGitUrl: 'git@github.com:acme/workbench.git',
        workspaceRootPath: '/tmp/workbench',
        docGitUrl: 'git@github.com:acme/workbench-docs.git',
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z'
      })
    ).toEqual({
      name: 'Workbench',
      description: '',
      repoGitUrl: 'git@github.com:acme/workbench.git',
      workspaceRootPath: '/tmp/workbench',
      docGitUrl: 'git@github.com:acme/workbench-docs.git'
    });
  });

  it('buildCreateProjectInput / buildUpdateProjectInput 应 trim 文本并归一化空描述', () => {
    expect(
      buildCreateProjectInput({
        name: ' Workbench ',
        description: '   ',
        repoGitUrl: 'git@github.com:acme/workbench.git',
        workspaceRootPath: '/tmp/workbench',
        docGitUrl: '  git@github.com:acme/workbench-docs.git  '
      })
    ).toEqual({
      name: 'Workbench',
      description: null,
      repoGitUrl: 'git@github.com:acme/workbench.git',
      workspaceRootPath: '/tmp/workbench',
      docGitUrl: 'git@github.com:acme/workbench-docs.git'
    });

    expect(
      buildUpdateProjectInput({
        name: ' Workbench ',
        description: '  Agent project  ',
        repoGitUrl: 'git@github.com:acme/workbench.git',
        workspaceRootPath: '/tmp/workbench',
        docGitUrl: '   '
      })
    ).toEqual({
      name: 'Workbench',
      description: 'Agent project',
      repoGitUrl: 'git@github.com:acme/workbench.git',
      workspaceRootPath: '/tmp/workbench',
      docGitUrl: null
    });
  });

  it('createProjectFormSchema 应拒绝空名称和非法 Git URL', () => {
    const parsed = createProjectFormSchema.safeParse({
      name: '',
      description: '',
      repoGitUrl: 'https://github.com/acme/workbench',
      workspaceRootPath: '',
      docGitUrl: './docs'
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'Project 名称不能为空',
          '工作根目录不能为空'
        ])
      );
    }
  });
});
