import type { SendSessionMessageInput } from '@agent-workbench/shared';

import type {
  RunnerConfigField,
  SupportedRunnerConfigSchema
} from '@/lib/runner-config-schema';
import {
  buildRunnerConfigInitialValues,
  normalizeRunnerConfigValues
} from '@/lib/runner-config-schema';

export function isTextLikeField(field: RunnerConfigField) {
  return field.kind === 'string' || field.kind === 'url';
}

export function getPrimaryInputField(fields: RunnerConfigField[]) {
  const promptField = fields.find(
    (field) => field.name === 'prompt' && isTextLikeField(field)
  );
  if (promptField) {
    return promptField;
  }

  const requiredTextFields = fields.filter(
    (field) => field.required && isTextLikeField(field)
  );
  if (requiredTextFields.length === 1) {
    return requiredTextFields[0];
  }

  const textFields = fields.filter(isTextLikeField);
  if (textFields.length === 1) {
    return textFields[0];
  }

  return undefined;
}

export function getAdditionalInputFields(
  schema: SupportedRunnerConfigSchema,
  primaryField: RunnerConfigField | undefined
) {
  if (!schema.supported) {
    return [];
  }

  return schema.fields.filter((field) => field.name !== primaryField?.name);
}

export function buildAdditionalInputInitialValues(fields: RunnerConfigField[]) {
  return buildRunnerConfigInitialValues(fields);
}

export function buildStructuredMessagePayload({
  schema,
  primaryField,
  composerText,
  additionalValues
}: {
  schema: Extract<SupportedRunnerConfigSchema, { supported: true }>;
  primaryField: RunnerConfigField;
  composerText: string;
  additionalValues: Record<string, unknown>;
}) {
  const normalizedInput = normalizeRunnerConfigValues(schema.fields, {
    ...additionalValues,
    [primaryField.name]: composerText.trim()
  });
  const validationResult = schema.validationSchema.safeParse(normalizedInput);

  if (!validationResult.success) {
    throw new Error(validationResult.error.issues[0]?.message ?? '消息输入校验失败');
  }

  return {
    input: validationResult.data
  } satisfies SendSessionMessageInput;
}

export function omitPrimaryFieldValue(
  input: Record<string, unknown> | null | undefined,
  primaryFieldName: string | undefined
) {
  if (!input || !primaryFieldName) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(([fieldName]) => fieldName !== primaryFieldName)
  );
}
