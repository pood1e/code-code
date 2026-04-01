import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

export function parseSchemaOrThrow<TSchema extends ZodType>(
  schema: TSchema,
  input: unknown,
  fallbackMessage: string
) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? fallbackMessage
    );
  }

  return parsed.data;
}
