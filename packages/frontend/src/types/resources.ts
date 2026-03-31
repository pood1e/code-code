import type { ResourceKind } from '@agent-workbench/shared';

export const resourceKinds: ResourceKind[] = ['skills', 'mcps', 'rules'];

export const resourceConfigMap: Record<
  ResourceKind,
  {
    path: string;
    singularLabel: string;
    pluralLabel: string;
    emptyState: string;
  }
> = {
  skills: {
    path: '/skills',
    singularLabel: 'Skill',
    pluralLabel: 'Skills',
    emptyState: '暂无数据'
  },
  mcps: {
    path: '/mcps',
    singularLabel: 'MCP',
    pluralLabel: 'MCPs',
    emptyState: '暂无数据'
  },
  rules: {
    path: '/rules',
    singularLabel: 'Rule',
    pluralLabel: 'Rules',
    emptyState: '暂无数据'
  }
};
