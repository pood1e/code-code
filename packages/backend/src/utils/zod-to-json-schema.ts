import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function convertZodSchemaToJsonSchema(schema: z.ZodType): object {
  return zodToJsonSchema(schema) as object;
}
