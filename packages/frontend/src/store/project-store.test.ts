import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from './project-store';

describe('project-store', () => {
  beforeEach(() => {
    useProjectStore.setState({ currentProjectId: null });
  });

  it('应支持设置和清空当前项目', () => {
    useProjectStore.getState().setCurrentProject('project-1');
    expect(useProjectStore.getState().currentProjectId).toBe('project-1');

    useProjectStore.getState().setCurrentProject(null);
    expect(useProjectStore.getState().currentProjectId).toBeNull();
  });
});
