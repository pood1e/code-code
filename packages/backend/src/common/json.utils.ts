import { Prisma } from '@prisma/client';

export function asPlainObject(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, unknown>;
}

export function sanitizeJson<T>(value: T): T {
  return structuredClone(value);
}

export function toInputJson(value: Prisma.InputJsonValue) {
  return value;
}

/** Returns the value as-is or `undefined` if absent. In Prisma, `undefined` means "do not update this field". */
export function toOptionalInputJson(value?: Prisma.InputJsonValue) {
  return value ?? undefined;
}

/**
 * Safely cast a Prisma string field to a TypeScript string enum value.
 * Throws if the value is not a valid enum member.
 */
export function castEnum<T extends string>(
  enumObj: Record<string, T>,
  raw: string,
  label: string
): T {
  const values = Object.values(enumObj) as string[];
  if (values.includes(raw)) {
    return raw as T;
  }
  throw new Error(`Invalid ${label}: "${raw}"`);
}
