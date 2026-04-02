import type {
  AgentRunnerDetail,
  CreateAgentRunnerInput,
  RunnerTypeResponse,
  UpdateAgentRunnerInput
} from '@agent-workbench/shared';
import { z } from 'zod';

// Re-export shared schema utilities so existing consumers don't need to change imports
export {
  parseRunnerConfigSchema,
  buildRunnerConfigInitialValues,
  normalizeRunnerConfigValues,
  getRunnerConfigFieldValue,
  type RunnerConfigField,
  type RunnerConfigFieldKind,
  type SupportedRunnerConfigSchema
} from '@/lib/runner-config-schema';

import {
  parseRunnerConfigSchema,
  buildRunnerConfigInitialValues,
  type RunnerConfigField
} from '@/lib/runner-config-schema';

export const agentRunnerEditorFormSchema = z.object({
  name: z.string().trim().min(1, 'Name 为必填项').max(100, 'Name 最多 100 个字符'),
  description: z
    .string()
    .trim()
    .max(500, 'Description 最多 500 个字符')
    .optional(),
  type: z.string().trim().min(1, '请选择 Runner Type'),
  runnerConfig: z.record(z.string(), z.unknown())
});

export type AgentRunnerEditorFormValues = z.infer<
  typeof agentRunnerEditorFormSchema
>;

function isPrimitiveDefault(
  value: unknown
): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function buildAgentRunnerInitialValues(
  runnerTypes: RunnerTypeResponse[],
  detail?: AgentRunnerDetail
): AgentRunnerEditorFormValues {
  const selectedType =
    runnerTypes.find((runnerType) => runnerType.id === detail?.type) ??
    runnerTypes[0];
  const parsedSchema = parseRunnerConfigSchema(selectedType?.runnerConfigSchema);

  return {
    name: detail?.name ?? '',
    description: detail?.description ?? '',
    type: selectedType?.id ?? '',
    runnerConfig:
      parsedSchema.supported && selectedType
        ? buildRunnerConfigInitialValues(
            parsedSchema.fields,
            detail?.runnerConfig
          )
        : (detail?.runnerConfig ?? {})
  };
}

export function buildCreateAgentRunnerInput(
  values: AgentRunnerEditorFormValues,
  runnerConfig: Record<string, unknown>
): CreateAgentRunnerInput {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    type: values.type,
    runnerConfig
  };
}

export function buildUpdateAgentRunnerInput(
  values: AgentRunnerEditorFormValues,
  runnerConfig: Record<string, unknown>
): UpdateAgentRunnerInput {
  const description = values.description?.trim();

  return {
    name: values.name.trim(),
    description: description && description.length > 0 ? description : null,
    runnerConfig
  };
}

export function getRunnerTypeName(
  runnerTypes: RunnerTypeResponse[],
  typeId: string
) {
  return runnerTypes.find((runnerType) => runnerType.id === typeId)?.name ?? typeId;
}

export function isRunnerConfigSchemaSupported(
  runnerType: RunnerTypeResponse | undefined
) {
  if (!runnerType) {
    return false;
  }

  return parseRunnerConfigSchema(runnerType.runnerConfigSchema).supported;
}

export function getRunnerConfigDefaultSummary(
  runnerType: RunnerTypeResponse | undefined
) {
  if (!runnerType) {
    return '';
  }

  const parsedSchema = parseRunnerConfigSchema(runnerType.runnerConfigSchema);
  if (!parsedSchema.supported || parsedSchema.fields.length === 0) {
    return '';
  }

  return parsedSchema.fields
    .filter((field: RunnerConfigField) => isPrimitiveDefault(field.defaultValue))
    .map((field: RunnerConfigField) => `${field.label}: ${String(field.defaultValue)}`)
    .join(' · ');
}

export function stringifyRunnerConfig(
  runnerConfig?: Record<string, unknown>
) {
  return JSON.stringify(runnerConfig ?? {}, null, 2);
}

export function parseRawRunnerConfigText(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        error: 'Runner Config 必须是 JSON 对象。'
      };
    }

    return {
      data: parsed as Record<string, unknown>
    };
  } catch {
    return {
      error: 'Runner Config 不是有效的 JSON。'
    };
  }
}
