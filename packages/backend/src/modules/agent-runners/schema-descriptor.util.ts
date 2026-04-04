import { z } from 'zod';
import type {
  SchemaDescriptor,
  SchemaFieldDescriptor,
  SchemaFieldKind
} from '@agent-workbench/shared';

/**
 * Convert a Zod schema into a SchemaDescriptor for API transmission.
 * This replaces the JSON Schema round-trip: backend Zod → JSON Schema → frontend parse.
 * Now the backend directly extracts field metadata from Zod and sends it in a
 * ready-to-render format.
 *
 * Uses Zod 4 internals (_zod.def) for introspection.
 */
export function zodToSchemaDescriptor(schema: z.ZodTypeAny): SchemaDescriptor {
  const unwrapped = unwrapToCore(schema);

  // Only object schemas produce field descriptors
  if (!(unwrapped instanceof z.ZodObject)) {
    return { fields: [] };
  }

  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
  const fields: SchemaFieldDescriptor[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const descriptor = zodFieldToDescriptor(name, fieldSchema);
    if (descriptor) {
      fields.push(descriptor);
    }
  }

  return { fields };
}

// ---- Internal helpers ----

type FieldMeta = {
  core: z.ZodTypeAny;
  isOptional: boolean;
  defaultValue: unknown;
  label: string | undefined;
  description: string | undefined;
  contextKey: string | undefined;
};

/**
 * Walk through Zod wrapper layers (optional, nullable, default, etc.)
 * collecting metadata, returning the innermost core type.
 */
function unwrapFieldMeta(schema: z.ZodTypeAny): FieldMeta {
  let current = schema;
  let isOptional = false;
  let defaultValue: unknown = undefined;
  let label: string | undefined;
  let description: string | undefined;
  let contextKey: string | undefined;

  for (let i = 0; i < 10; i++) {
    const metadata =
      typeof current.meta === 'function'
        ? (current.meta() as
            | {
                label?: unknown;
                description?: unknown;
                contextKey?: unknown;
              }
            | undefined)
        : undefined;

    if (typeof metadata?.label === 'string' && !label) {
      label = metadata.label;
    }
    if (typeof metadata?.description === 'string' && !description) {
      description = metadata.description;
    }
    if (typeof metadata?.contextKey === 'string' && !contextKey) {
      contextKey = metadata.contextKey;
    }

    // Capture description at any level
    if (current.description && !description) {
      description = current.description;
    }

    const def = current._def as unknown as Record<string, unknown>;
    const defType = (def.typeName as string) ?? (def.type as string);

    if (defType === 'optional' || defType === 'nullable') {
      isOptional = true;
      current = def.innerType as z.ZodTypeAny;
      continue;
    }

    if (defType === 'default') {
      isOptional = true;
      defaultValue = def.defaultValue;
      current = def.innerType as z.ZodTypeAny;
      continue;
    }

    // Other wrappers (pipe, effects, etc.)
    if (def.innerType) {
      current = def.innerType as z.ZodTypeAny;
      continue;
    }

    break;
  }

  return {
    core: current,
    isOptional,
    defaultValue,
    label,
    description,
    contextKey
  };
}

/**
 * Simple unwrap to get the core schema (for top-level type checking).
 */
function unwrapToCore(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  for (let i = 0; i < 10; i++) {
    const def = current._def as unknown as Record<string, unknown>;
    if (def.innerType) {
      current = def.innerType as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return current;
}

function toFieldLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function zodFieldToDescriptor(
  name: string,
  schema: z.ZodTypeAny
): SchemaFieldDescriptor | null {
  const { core, isOptional, defaultValue, label, description, contextKey } =
    unwrapFieldMeta(schema);

  let cleanDescription: string | undefined = description;
  const resolvedContextKey =
    contextKey ??
    (description?.startsWith('context:')
      ? description.slice('context:'.length).trim()
      : undefined);
  if (description?.startsWith('context:')) {
    cleanDescription = undefined;
  }

  const required = !isOptional;
  const resolvedLabel = label ?? toFieldLabel(name);

  const coreDef = core._def as unknown as Record<string, unknown>;
  const coreType = (coreDef.typeName as string) ?? (coreDef.type as string);

  // Enum
  if (coreType === 'enum') {
    const entries = coreDef.entries as Record<string, string>;
    const values = Object.values(entries);
    return {
      name,
      label: resolvedLabel,
      description: cleanDescription,
      kind: 'enum',
      required,
      defaultValue: normalizeDefault(defaultValue),
      enumOptions: values.map((v) => ({ label: v, value: v })),
      contextKey: resolvedContextKey
    };
  }

  // String
  if (coreType === 'string') {
    const kind: SchemaFieldKind = cleanDescription === 'url' ? 'url' : 'string';
    return {
      name,
      label: resolvedLabel,
      description: cleanDescription,
      kind,
      required,
      defaultValue: normalizeDefault(defaultValue),
      contextKey: resolvedContextKey
    };
  }

  // Number
  if (coreType === 'number') {
    const checks = coreDef.checks as Array<Record<string, unknown>> | undefined;
    const hasIntCheck =
      checks?.some((check) => {
        const isInt = (check as { isInt?: boolean }).isInt;
        return isInt === true;
      }) ?? false;
    return {
      name,
      label: resolvedLabel,
      description: cleanDescription,
      kind: hasIntCheck ? 'integer' : 'number',
      required,
      defaultValue: normalizeDefault(defaultValue),
      contextKey: resolvedContextKey
    };
  }

  // Boolean
  if (coreType === 'boolean') {
    return {
      name,
      label: resolvedLabel,
      description: cleanDescription,
      kind: 'boolean',
      required,
      defaultValue: normalizeDefault(defaultValue),
      contextKey: resolvedContextKey
    };
  }

  // Unsupported type — skip
  return null;
}

function normalizeDefault(
  value: unknown
): string | number | boolean | undefined {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return undefined;
}
