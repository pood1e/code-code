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
    emptyState: '还没有任何 Skill，先创建一个新的 Skill。'
  },
  mcps: {
    path: '/mcps',
    singularLabel: 'MCP',
    pluralLabel: 'MCPs',
    emptyState: '还没有任何 MCP，先创建一个新的 MCP。'
  },
  rules: {
    path: '/rules',
    singularLabel: 'Rule',
    pluralLabel: 'Rules',
    emptyState: '还没有任何 Rule，先创建一个新的 Rule。'
  }
};
