import type {
  SchemaDescriptor,
  SchemaFieldDescriptor
} from '@agent-workbench/shared';
import { z } from 'zod';

// Re-export SchemaFieldDescriptor as RunnerConfigField for backward compatibility
export type RunnerConfigField = SchemaFieldDescriptor;

export type RunnerConfigFieldKind = SchemaFieldDescriptor['kind'];

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

export function shouldRenderEmptyEnumOption(field: RunnerConfigField) {
  return field.kind === 'enum' && !field.required && field.defaultValue === undefined;
}

export function getRunnerConfigSelectOptions(
  field: RunnerConfigField,
  discoveredOptions?: Array<{ label: string; value: string } | string>
) {
  if (Array.isArray(discoveredOptions) && discoveredOptions.length > 0) {
    return discoveredOptions.map((item) =>
      typeof item === 'string' ? { label: item, value: item } : item
    );
  }

  if (field.kind !== 'enum') {
    return [];
  }

  return (
    field.enumOptions?.map((option) => ({
      label: option.label,
      value: String(option.value)
    })) ?? []
  );
}

export type StringMapEntry = {
  key: string;
  value: string;
};

function buildFieldSchema(field: RunnerConfigField) {
  if (field.kind === 'string_map') {
    const schema = z.record(z.string(), z.string());
    return field.required ? schema : schema.optional();
  }

  if (field.kind === 'enum') {
    const values = field.enumOptions?.map((option) => option.value) ?? [];

    if (values.length > 0 && typeof values[0] === 'number') {
      const schema = z
        .number()
        .refine(
          (value) => values.includes(value),
          `${field.label} 不在允许范围内`
        );
      return field.required ? schema : schema.optional();
    }

    const schema = z
      .string()
      .refine(
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

/**
 * Parse a SchemaDescriptor into a SupportedRunnerConfigSchema.
 * Now that the backend sends pre-parsed field descriptors,
 * this function just builds the Zod validation schema — no JSON Schema parsing needed.
 */
export function parseRunnerConfigSchema(
  schema: SchemaDescriptor | null | undefined
): SupportedRunnerConfigSchema {
  if (!schema || !schema.fields) {
    return {
      supported: false,
      reason: '当前 RunnerType 未提供可编辑的对象结构配置。'
    };
  }

  const fields = schema.fields;

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

function normalizeRunnerConfigValue(
  field: RunnerConfigField,
  rawValue: unknown
) {
  if (field.kind === 'string_map') {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return undefined;
    }

    const normalized = Object.entries(rawValue).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const trimmedKey = key.trim();
        if (!trimmedKey || typeof value !== 'string') {
          return acc;
        }

        acc[trimmedKey] = value;
        return acc;
      },
      {}
    );

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

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
      const hasNumericOptions = field.enumOptions?.some(
        (opt) => typeof opt.value === 'number'
      );
      if (hasNumericOptions) {
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

  if (field.kind === 'string_map') {
    return {};
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
      values[field.name] = normalizeRunnerConfigValue(
        field,
        source[field.name]
      );
      continue;
    }

    values[field.name] = getFieldDefaultValue(field);
  }

  return values;
}

export function normalizeRunnerConfigValues(
  fields: RunnerConfigField[],
  values: Record<string, unknown>
) {
  const normalizedValues: Record<string, unknown> = {};

  for (const field of fields) {
    const normalizedValue = normalizeRunnerConfigValue(
      field,
      values[field.name]
    );
    if (normalizedValue !== undefined) {
      normalizedValues[field.name] = normalizedValue;
    }
  }

  return normalizedValues;
}

export function getRunnerConfigFieldValue(
  field: RunnerConfigField,
  value: unknown
) {
  if (field.kind === 'string_map') {
    return '';
  }

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

export function toStringMapEntries(value: unknown): StringMapEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).map(([key, entryValue]) => ({
    key,
    value: typeof entryValue === 'string' ? entryValue : ''
  }));
}

export function toStringMapObject(entries: readonly StringMapEntry[]) {
  return entries.reduce<Record<string, string>>((acc, entry) => {
    const key = entry.key.trim();
    if (!key) {
      return acc;
    }

    acc[key] = entry.value;
    return acc;
  }, {});
}
