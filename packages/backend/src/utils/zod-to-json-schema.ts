import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  ReferenceObject,
  SchemaObject
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export function convertZodSchemaToJsonSchema(schema: z.ZodTypeAny): object {
  return zodToJsonSchema(
    schema as unknown as Parameters<typeof zodToJsonSchema>[0]
  ) as object;
}

type SwaggerSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array';

export type SwaggerSchemaOptions = {
  type?: SwaggerSchemaType;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  items?: Record<string, unknown>;
};

export type SwaggerObjectSchemaOptions = {
  type: 'object';
  title?: string;
  description?: string;
  default?: unknown;
  additionalProperties: SchemaObject | ReferenceObject | boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSwaggerSchemaType(value: unknown): value is SwaggerSchemaType {
  return (
    value === 'string' ||
    value === 'number' ||
    value === 'integer' ||
    value === 'boolean' ||
    value === 'object' ||
    value === 'array'
  );
}

function isOpenApiSchemaLike(
  value: unknown
): value is SchemaObject | ReferenceObject {
  return isRecord(value);
}

export function convertZodSchemaToSwaggerSchemaOptions(
  schema: z.ZodTypeAny
): SwaggerSchemaOptions {
  const jsonSchema = convertZodSchemaToJsonSchema(schema);

  if (!isRecord(jsonSchema)) {
    return {};
  }

  const swaggerSchemaOptions: SwaggerSchemaOptions = {};

  if (isSwaggerSchemaType(jsonSchema.type)) {
    swaggerSchemaOptions.type = jsonSchema.type;
  }

  if (typeof jsonSchema.title === 'string') {
    swaggerSchemaOptions.title = jsonSchema.title;
  }

  if (typeof jsonSchema.description === 'string') {
    swaggerSchemaOptions.description = jsonSchema.description;
  }

  if ('default' in jsonSchema) {
    swaggerSchemaOptions.default = jsonSchema.default;
  }

  if (Array.isArray(jsonSchema.enum)) {
    swaggerSchemaOptions.enum = jsonSchema.enum;
  }

  if (typeof jsonSchema.format === 'string') {
    swaggerSchemaOptions.format = jsonSchema.format;
  }

  if (isRecord(jsonSchema.properties)) {
    swaggerSchemaOptions.properties = jsonSchema.properties;
  }

  if (
    Array.isArray(jsonSchema.required) &&
    jsonSchema.required.every((value) => typeof value === 'string')
  ) {
    swaggerSchemaOptions.required = jsonSchema.required;
  }

  if (
    typeof jsonSchema.additionalProperties === 'boolean' ||
    isRecord(jsonSchema.additionalProperties)
  ) {
    swaggerSchemaOptions.additionalProperties = jsonSchema.additionalProperties;
  }

  if (isRecord(jsonSchema.items)) {
    swaggerSchemaOptions.items = jsonSchema.items;
  }

  return swaggerSchemaOptions;
}

export function convertZodSchemaToSwaggerObjectSchemaOptions(
  schema: z.ZodTypeAny
): SwaggerObjectSchemaOptions {
  const jsonSchema = convertZodSchemaToJsonSchema(schema);

  if (
    !isRecord(jsonSchema) ||
    jsonSchema.type !== 'object' ||
    !(
      typeof jsonSchema.additionalProperties === 'boolean' ||
      isOpenApiSchemaLike(jsonSchema.additionalProperties)
    )
  ) {
    throw new Error('Expected an object JSON schema with additionalProperties');
  }

  const swaggerObjectSchemaOptions: SwaggerObjectSchemaOptions = {
    type: 'object',
    additionalProperties: jsonSchema.additionalProperties
  };

  if (typeof jsonSchema.title === 'string') {
    swaggerObjectSchemaOptions.title = jsonSchema.title;
  }

  if (typeof jsonSchema.description === 'string') {
    swaggerObjectSchemaOptions.description = jsonSchema.description;
  }

  if ('default' in jsonSchema) {
    swaggerObjectSchemaOptions.default = jsonSchema.default;
  }

  return swaggerObjectSchemaOptions;
}
