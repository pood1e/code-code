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
      gitUrl: '',
      workspacePath: ''
    });

    expect(
      buildProjectFormValues({
        id: 'project-1',
        name: 'Workbench',
        description: null,
        gitUrl: 'git@github.com:acme/workbench.git',
        workspacePath: '/tmp/workbench',
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z'
      })
    ).toEqual({
      name: 'Workbench',
      description: '',
      gitUrl: 'git@github.com:acme/workbench.git',
      workspacePath: '/tmp/workbench'
    });
  });

  it('buildCreateProjectInput / buildUpdateProjectInput 应 trim 文本并归一化空描述', () => {
    expect(
      buildCreateProjectInput({
        name: ' Workbench ',
        description: '   ',
        gitUrl: 'git@github.com:acme/workbench.git',
        workspacePath: '/tmp/workbench'
      })
    ).toEqual({
      name: 'Workbench',
      description: null,
      gitUrl: 'git@github.com:acme/workbench.git',
      workspacePath: '/tmp/workbench'
    });

    expect(
      buildUpdateProjectInput({
        name: ' Workbench ',
        description: '  Agent project  ',
        gitUrl: 'git@github.com:acme/workbench.git',
        workspacePath: '/tmp/workbench'
      })
    ).toEqual({
      name: 'Workbench',
      description: 'Agent project',
      workspacePath: '/tmp/workbench'
    });
  });

  it('createProjectFormSchema 应拒绝空名称和非法 Git URL', () => {
    const parsed = createProjectFormSchema.safeParse({
      name: '',
      description: '',
      gitUrl: 'https://github.com/acme/workbench',
      workspacePath: ''
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'Project 名称不能为空',
          'Workspace 路径不能为空'
        ])
      );
    }
  });
});
