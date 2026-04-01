import {
  mcpInputSchema,
  ruleInputSchema,
  skillInputSchema,
  type McpResource,
  type ResourceKind,
  type ResourceRecord
} from '@agent-workbench/shared';

import type { ResourcePayloadByKind } from '../../api/resources';

export type EnvEntry = {
  key: string;
  value: string;
};

export type ResourceFormValues = {
  name: string;
  description?: string;
  contentText?: string;
  type?: 'stdio';
  command?: string;
  args?: string[];
  envEntries?: EnvEntry[];
};

export function createInitialValues(kind: ResourceKind): ResourceFormValues {
  if (kind === 'mcps') {
    return {
      name: '',
      description: '',
      type: 'stdio',
      command: '',
      args: [],
      envEntries: []
    };
  }

  return {
    name: '',
    description: '',
    contentText: ''
  };
}

export function toEnvEntries(env?: Record<string, string>): EnvEntry[] {
  if (!env) {
    return [];
  }

  return Object.entries(env).map(([key, value]) => ({ key, value }));
}

export function toEnvObject(entries?: EnvEntry[]) {
  const result = (entries ?? []).reduce<Record<string, string>>(
    (acc, entry) => {
      const key = entry.key.trim();
      if (!key) {
        return acc;
      }

      acc[key] = entry.value;
      return acc;
    },
    {}
  );

  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeDescription(description?: string) {
  return description?.trim() ? description.trim() : null;
}

export type ResourceMutationPayload = ResourcePayloadByKind[ResourceKind];

export function toResourceFormValues(resource: ResourceRecord): ResourceFormValues {
  if (typeof resource.content === 'string') {
    return {
      name: resource.name,
      description: resource.description ?? '',
      contentText: resource.content
    };
  }

  const mcpResource = resource as McpResource;

  return {
    name: mcpResource.name,
    description: mcpResource.description ?? '',
    type: mcpResource.content.type,
    command: mcpResource.content.command,
    args: mcpResource.content.args,
    envEntries: toEnvEntries(mcpResource.content.env)
  };
}

export function buildMcpPayload(values: ResourceFormValues) {
  const parsed = mcpInputSchema.safeParse({
    name: values.name,
    description: normalizeDescription(values.description),
    content: {
      type: 'stdio',
      command: values.command?.trim() ?? '',
      args: (values.args ?? []).map((item) => item.trim()).filter(Boolean),
      env: toEnvObject(values.envEntries)
    }
  });

  return parsed.success
    ? { data: parsed.data, error: null }
    : {
        data: null,
        error: parsed.error.issues[0]?.message ?? 'Invalid MCP content.'
      };
}

export function buildMarkdownPayload(
  kind: Exclude<ResourceKind, 'mcps'>,
  values: ResourceFormValues
) {
  const payload = {
    name: values.name,
    description: normalizeDescription(values.description),
    content: values.contentText ?? ''
  };
  const schema = kind === 'skills' ? skillInputSchema : ruleInputSchema;
  const parsed = schema.safeParse(payload);

  return parsed.success
    ? { data: parsed.data, error: null }
    : {
        data: null,
        error: parsed.error.issues[0]?.message ?? 'Invalid Markdown content.'
      };
}
