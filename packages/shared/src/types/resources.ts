export type ResourceKind = 'skills' | 'mcps' | 'rules';

export type ResourceBase = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type McpStdioContent = {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type McpConfigOverride = {
  type?: 'stdio';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export type SkillResource = ResourceBase & {
  content: string;
};

export type RuleResource = ResourceBase & {
  content: string;
};

export type McpResource = ResourceBase & {
  content: McpStdioContent;
};

export type ResourceByKind = {
  skills: SkillResource;
  mcps: McpResource;
  rules: RuleResource;
};

export type ResourceRecord = ResourceByKind[ResourceKind];

export type Profile = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileReference = {
  id: string;
  name: string;
};

export type ProfileItemInput = {
  resourceId: string;
  order: number;
};

export type McpProfileItemInput = ProfileItemInput & {
  configOverride?: McpConfigOverride;
};

export type ProfileItemsPayload = {
  skills: ProfileItemInput[];
  mcps: McpProfileItemInput[];
  rules: ProfileItemInput[];
};

export type SkillResolvedItem = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  resolved: string;
  order: number;
};

export type RuleResolvedItem = SkillResolvedItem;

export type McpResolvedItem = {
  id: string;
  name: string;
  description: string | null;
  content: McpStdioContent;
  configOverride: McpConfigOverride;
  resolved: McpStdioContent;
  order: number;
};

export type RenderedProfile = {
  id: string;
  name: string;
  description: string | null;
  skills: SkillResolvedItem[];
  mcps: McpResolvedItem[];
  rules: RuleResolvedItem[];
};

export type ProfileDetail = Profile & {
  skills: SkillResolvedItem[];
  mcps: McpResolvedItem[];
  rules: RuleResolvedItem[];
};
