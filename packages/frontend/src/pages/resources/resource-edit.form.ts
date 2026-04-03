import {
  mcpInputSchema,
  ruleInputSchema,
  skillInputSchema,
  type McpInput,
  type McpResource,
  type ResourceKind,
  type ResourceRecord,
  type RuleInput,
  type SkillInput
} from '@agent-workbench/shared';
import { z } from 'zod';

import type { ResourcePayloadByKind } from '../../api/resources';
import { normalizeDescription } from '@/utils/format-display';

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
  argsText?: string;
  envEntries?: EnvEntry[];
};

export const resourceMarkdownFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional(),
  contentText: z.string().min(1, 'Content is required')
});
export type ResourceMarkdownFormValues = z.infer<
  typeof resourceMarkdownFormSchema
>;

export const resourceMcpFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional(),
  type: z.literal('stdio').optional(),
  command: z.string().trim().min(1, 'Command is required'),
  argsText: z.string().optional(),
  envEntries: z.array(
    z.object({
      key: z.string(),
      value: z.string()
    })
  )
});
export type ResourceMcpFormValues = z.infer<typeof resourceMcpFormSchema>;

export function createInitialValues(kind: ResourceKind): ResourceFormValues {
  if (kind === 'mcps') {
    return {
      name: '',
      description: '',
      type: 'stdio',
      command: '',
      argsText: '',
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

export type ResourceMutationPayload = ResourcePayloadByKind[ResourceKind];

function toResourceFormValues(resource: ResourceRecord): ResourceFormValues {
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
    argsText: mcpResource.content.args.join('\n'),
    envEntries: toEnvEntries(mcpResource.content.env)
  };
}

function buildMcpPayload(values: ResourceFormValues) {
  const parsed = mcpInputSchema.safeParse({
    name: values.name,
    description: normalizeDescription(values.description),
    content: {
      type: 'stdio',
      command: values.command?.trim() ?? '',
      args: (values.argsText ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
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

function buildMarkdownPayload(
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

type ResourceEditConfig<K extends ResourceKind> = {
  contentMode: 'markdown' | 'mcp';
  createInitialValues: () => ResourceFormValues;
  toFormValues: (resource: ResourceRecord) => ResourceFormValues;
  buildPayload: (values: ResourceFormValues) => {
    data: ResourcePayloadByKind[K] | null;
    error: string | null;
  };
};

export const resourceEditConfigMap: {
  [K in ResourceKind]: ResourceEditConfig<K>;
} = {
  skills: {
    contentMode: 'markdown',
    createInitialValues: () => createInitialValues('skills'),
    toFormValues: toResourceFormValues,
    buildPayload: (values) =>
      buildMarkdownPayload('skills', values) as {
        data: SkillInput | null;
        error: string | null;
      }
  },
  mcps: {
    contentMode: 'mcp',
    createInitialValues: () => createInitialValues('mcps'),
    toFormValues: toResourceFormValues,
    buildPayload: (values) =>
      buildMcpPayload(values) as {
        data: McpInput | null;
        error: string | null;
      }
  },
  rules: {
    contentMode: 'markdown',
    createInitialValues: () => createInitialValues('rules'),
    toFormValues: toResourceFormValues,
    buildPayload: (values) =>
      buildMarkdownPayload('rules', values) as {
        data: RuleInput | null;
        error: string | null;
      }
  }
};
