import type {
  AgentRunnerDetail,
  CreateAgentRunnerInput,
  RunnerConfigJsonSchema,
  RunnerConfigJsonSchemaProperty,
  RunnerTypeResponse,
  UpdateAgentRunnerInput
} from '@agent-workbench/shared';
import { z } from 'zod';

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

export type RunnerConfigFieldKind =
  | 'string'
  | 'url'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum';

type RunnerConfigEnumOption = {
  label: string;
  value: string | number;
};

type RunnerConfigEnumValueType = 'string' | 'number';

export type RunnerConfigField = {
  name: string;
  label: string;
  description?: string;
  kind: RunnerConfigFieldKind;
  required: boolean;
  defaultValue?: string | number | boolean;
  enumOptions?: RunnerConfigEnumOption[];
  enumValueType?: RunnerConfigEnumValueType;
};

export type SupportedRunnerConfigSchema =
  | {
      supported: true;
      fields: RunnerConfigField[];
      validationSchema: z.ZodObject<Record<string, z.ZodType>>;
    }
  | {
      supported: false;
      reason: string;
    };

function toFieldLabel(name: string, title?: string) {
  if (title?.trim()) {
    return title.trim();
  }

  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase());
}

function isPrimitiveDefault(
  value: unknown
): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function parseEnumProperty(
  name: string,
  property: RunnerConfigJsonSchemaProperty,
  required: boolean
): RunnerConfigField | null {
  if (!Array.isArray(property.enum) || property.enum.length === 0) {
    return null;
  }

  if (property.enum.every((value) => typeof value === 'string')) {
    return {
      name,
      label: toFieldLabel(name, property.title),
      description: property.description,
      kind: 'enum',
      required,
      defaultValue:
        typeof property.default === 'string' ? property.default : undefined,
      enumValueType: 'string',
      enumOptions: property.enum.map((value) => ({
        label: value,
        value
      }))
    };
  }

  if (property.enum.every((value) => typeof value === 'number')) {
    return {
      name,
      label: toFieldLabel(name, property.title),
      description: property.description,
      kind: 'enum',
      required,
      defaultValue:
        typeof property.default === 'number' ? property.default : undefined,
      enumValueType: 'number',
      enumOptions: property.enum.map((value) => ({
        label: String(value),
        value
      }))
    };
  }

  return null;
}

function parseProperty(
  name: string,
  property: RunnerConfigJsonSchemaProperty,
  required: boolean
): RunnerConfigField | null {
  const enumField = parseEnumProperty(name, property, required);
  if (enumField) {
    return enumField;
  }

  switch (property.type) {
    case 'string':
      return {
        name,
        label: toFieldLabel(name, property.title),
        description: property.description,
        kind: property.format === 'url' ? 'url' : 'string',
        required,
        defaultValue:
          typeof property.default === 'string' ? property.default : undefined
      };
    case 'number':
      return {
        name,
        label: toFieldLabel(name, property.title),
        description: property.description,
        kind: 'number',
        required,
        defaultValue:
          typeof property.default === 'number' ? property.default : undefined
      };
    case 'integer':
      return {
        name,
        label: toFieldLabel(name, property.title),
        description: property.description,
        kind: 'integer',
        required,
        defaultValue:
          typeof property.default === 'number' ? property.default : undefined
      };
    case 'boolean':
      return {
        name,
        label: toFieldLabel(name, property.title),
        description: property.description,
        kind: 'boolean',
        required,
        defaultValue:
          typeof property.default === 'boolean' ? property.default : undefined
      };
    default:
      return null;
  }
}

function buildFieldSchema(field: RunnerConfigField) {
  if (field.kind === 'enum') {
    const values = field.enumOptions?.map((option) => option.value) ?? [];

    if (field.enumValueType === 'number') {
      const schema = z.number().refine(
        (value) => values.includes(value),
        `${field.label} 不在允许范围内`
      );
      return field.required ? schema : schema.optional();
    }

    const schema = z.string().refine(
      (value) => values.includes(value),
      `${field.label} 不在允许范围内`
    );
    return field.required ? schema : schema.optional();
  }

  if (field.kind === 'url') {
    const schema = z.url({ error: '请输入有效 URL' });
    return field.required ? schema : schema.optional();
  }

  if (field.kind === 'string') {
    const schema = z.string().min(1, `${field.label} 为必填项`);
    return field.required ? schema : schema.optional();
  }

  if (field.kind === 'number') {
    const schema = z.number();
    return field.required ? schema : schema.optional();
  }

  if (field.kind === 'integer') {
    const schema = z.number().int(`${field.label} 必须为整数`);
    return field.required ? schema : schema.optional();
  }

  const schema = z.boolean();
  return field.required ? schema : schema.optional();
}

export function parseRunnerConfigSchema(
  schema: RunnerConfigJsonSchema | null | undefined
): SupportedRunnerConfigSchema {
  if (!schema || schema.type !== 'object') {
    return {
      supported: false,
      reason: '当前 RunnerType 未提供可编辑的对象结构配置。'
    };
  }

  const properties = schema.properties ?? {};
  const requiredFields = new Set(schema.required ?? []);
  const fields: RunnerConfigField[] = [];

  for (const [name, property] of Object.entries(properties)) {
    const parsed = parseProperty(name, property, requiredFields.has(name));
    if (!parsed) {
      return {
        supported: false,
        reason: `字段 ${name} 使用了当前工作台尚未支持的 Schema 能力。`
      };
    }
    fields.push(parsed);
  }

  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    shape[field.name] = buildFieldSchema(field);
  }

  return {
    supported: true,
    fields,
    validationSchema: z.object(shape)
  };
}

function normalizeRunnerConfigValue(field: RunnerConfigField, rawValue: unknown) {
  if (field.kind === 'boolean') {
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }
    if (typeof rawValue === 'string') {
      if (rawValue === 'true') {
        return true;
      }
      if (rawValue === 'false') {
        return false;
      }
    }
    return rawValue;
  }

  if (field.kind === 'number' || field.kind === 'integer') {
    if (typeof rawValue === 'number') {
      return Number.isNaN(rawValue) ? undefined : rawValue;
    }
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        return undefined;
      }

      const numericValue = Number(trimmed);
      return Number.isNaN(numericValue) ? rawValue : numericValue;
    }
    return rawValue;
  }

  if (field.kind === 'enum') {
    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      if (field.enumValueType === 'number') {
        const numericValue = Number(trimmed);
        return Number.isNaN(numericValue) ? rawValue : numericValue;
      }
      return trimmed;
    }
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed.length === 0 && !field.required) {
      return undefined;
    }
    return trimmed;
  }

  return rawValue;
}

function getFieldDefaultValue(field: RunnerConfigField) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.kind === 'boolean') {
    return undefined;
  }

  return '';
}

export function buildRunnerConfigInitialValues(
  fields: RunnerConfigField[],
  source?: Record<string, unknown>
) {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (source && field.name in source) {
      values[field.name] = normalizeRunnerConfigValue(field, source[field.name]);
      continue;
    }

    values[field.name] = getFieldDefaultValue(field);
  }

  return values;
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

export function normalizeRunnerConfigValues(
  fields: RunnerConfigField[],
  values: Record<string, unknown>
) {
  const normalizedValues: Record<string, unknown> = {};

  for (const field of fields) {
    const normalizedValue = normalizeRunnerConfigValue(field, values[field.name]);
    if (normalizedValue !== undefined) {
      normalizedValues[field.name] = normalizedValue;
    }
  }

  return normalizedValues;
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

export function getRunnerConfigFieldValue(
  field: RunnerConfigField,
  value: unknown
) {
  if (field.kind === 'number' || field.kind === 'integer') {
    return typeof value === 'number' ? String(value) : '';
  }

  if (field.kind === 'enum') {
    if (typeof value === 'number' || typeof value === 'string') {
      return String(value);
    }
    return '';
  }

  return typeof value === 'string' ? value : '';
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
    .filter((field) => isPrimitiveDefault(field.defaultValue))
    .map((field) => `${field.label}: ${String(field.defaultValue)}`)
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
