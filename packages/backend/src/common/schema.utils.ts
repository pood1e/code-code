import { BadRequestException } from '@nestjs/common';
import { z, type ZodTypeAny } from 'zod';

export function parseSchemaOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  fallbackMessage: string
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? fallbackMessage
    );
  }

  return parsed.data;
}
