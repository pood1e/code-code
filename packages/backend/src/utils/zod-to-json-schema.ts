import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function convertZodSchemaToJsonSchema(schema: z.ZodTypeAny): object {
  return zodToJsonSchema(
    schema as unknown as Parameters<typeof zodToJsonSchema>[0]
  ) as object;
}
