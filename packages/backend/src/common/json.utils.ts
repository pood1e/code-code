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
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toInputJson(value: Prisma.InputJsonValue) {
  return value;
}

/** Returns the value as-is or `undefined` if absent. In Prisma, `undefined` means "do not update this field". */
export function toOptionalInputJson(value?: Prisma.InputJsonValue) {
  return value ?? undefined;
}
