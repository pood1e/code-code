import { z } from 'zod';

import { mcpConfigOverrideSchema } from './resources';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus,
  SessionWorkspaceResourceConfig,
  SessionWorkspaceMode,
  SessionWorkspaceResourceKind
} from '../types/session';

const idSchema = z.string().trim().min(1);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const sessionStatusSchema = z.nativeEnum(SessionStatus);
export const messageStatusSchema = z.nativeEnum(MessageStatus);
export const messageRoleSchema = z.nativeEnum(MessageRole);
export const metricKindSchema = z.nativeEnum(MetricKind);
export const toolCallKindSchema = z
  .string()
  .trim()
  .min(1);

export const platformSessionMcpSchema = z.object({
  resourceId: idSchema,
  configOverride: mcpConfigOverrideSchema.optional()
});

const workspaceBranchSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().trim().min(1).max(255).optional());

const customRunDirectorySchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}, z
  .string()
  .trim()
  .min(1, 'customRunDirectory is required')
  .refine((value) => !value.startsWith('/'), 'customRunDirectory must be relative')
  .refine((value) => !value.split('/').some((segment) => segment === '..'), 'customRunDirectory must stay within the session directory')
  .optional());

export const sessionWorkspaceResourceConfigSchema = z
  .object({
    code: z
      .object({
        branch: workspaceBranchSchema
      })
      .optional(),
    doc: z
      .object({
        branch: workspaceBranchSchema
      })
      .optional()
  })
  .default({} satisfies SessionWorkspaceResourceConfig);

export const platformSessionConfigSchema = z.object({
  workspaceMode: z
    .nativeEnum(SessionWorkspaceMode)
    .default(SessionWorkspaceMode.Project),
  workspaceRoot: z.string().trim().min(1).optional(),
  sessionRoot: z.string().trim().min(1).optional(),
  cwd: z.string().trim().min(1),
  workspaceResources: z
    .array(z.nativeEnum(SessionWorkspaceResourceKind))
    .default([]),
  workspaceResourceConfig: sessionWorkspaceResourceConfigSchema,
  skillIds: z.array(idSchema),
  ruleIds: z.array(idSchema),
  mcps: z.array(platformSessionMcpSchema)
}).transform((value) => ({
  ...value,
  workspaceRoot: value.workspaceRoot ?? value.cwd
}));

export const sendSessionMessageInputSchema = z.object({
  input: jsonObjectSchema,
  runtimeConfig: jsonObjectSchema.optional()
});

export const createSessionInputSchema = z.object({
  scopeId: idSchema,
  runnerId: idSchema,
  customRunDirectory: customRunDirectorySchema,
  workspaceResources: z
    .array(z.nativeEnum(SessionWorkspaceResourceKind))
    .default([]),
  workspaceResourceConfig: sessionWorkspaceResourceConfigSchema,
  skillIds: z.array(idSchema),
  ruleIds: z.array(idSchema),
  mcps: z.array(platformSessionMcpSchema),
  runnerSessionConfig: jsonObjectSchema,
  initialMessage: sendSessionMessageInputSchema.optional()
});

export const editSessionMessageInputSchema = sendSessionMessageInputSchema;

export const errorPayloadSchema = z.object({
  message: z.string().trim().min(1),
  code: z.string().trim().min(1),
  recoverable: z.boolean()
});

export const sessionConflictReasonSchema = z.enum([
  'RUNNING',
  'DISPOSING',
  'ERROR'
]);

export const apiErrorResponseSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().nullable()
});

export const usageMetricDataSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  modelId: z.string().optional()
});

export const sessionMessageMetricSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  messageId: idSchema.nullable(),
  eventId: z.number().int().nonnegative(),
  kind: metricKindSchema,
  data: usageMetricDataSchema.and(jsonObjectSchema),
  createdAt: z.string().datetime()
});

export const textMessagePartSchema = z.object({
  type: z.literal('text'),
  text: z.string()
});

export const thinkingMessagePartSchema = z.object({
  type: z.literal('thinking'),
  text: z.string()
});

export const toolCallMessagePartSchema = z.object({
  type: z.literal('tool_call'),
  toolCallId: z.string().trim().min(1),
  toolKind: toolCallKindSchema.optional(),
  toolName: z.string().trim().min(1),
  args: z.unknown(),
  result: z.unknown().optional(),
  isError: z.boolean().optional()
});

export const sessionMessagePartSchema = z.discriminatedUnion('type', [
  textMessagePartSchema,
  thinkingMessagePartSchema,
  toolCallMessagePartSchema
]);

export const sessionMessageContentPartsSchema = z.array(
  sessionMessagePartSchema
);

export const toolUseDataSchema = z.object({
  toolKind: toolCallKindSchema,
  toolName: z.string().trim().min(1),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  callId: z.string().optional()
});

export const outputChunkKindSchema = z.enum([
  'session_status',
  'thinking_delta',
  'message_delta',
  'message_result',
  'tool_use',
  'usage',
  'error',
  'done'
]);

export const outputChunkSchema = z.object({
  kind: outputChunkKindSchema,
  sessionId: idSchema,
  eventId: z.number().int().nonnegative(),
  timestampMs: z.number().int().nonnegative(),
  messageId: idSchema.optional(),
  data: z.unknown().optional()
});

export const sessionMessageInputContentSchema = jsonObjectSchema;
export const sessionMessageRuntimeConfigSchema = jsonObjectSchema;

export type PlatformSessionConfigInput = z.infer<
  typeof platformSessionConfigSchema
>;
export type CreateSessionInputSchema = z.infer<typeof createSessionInputSchema>;
export type SendSessionMessageInputSchema = z.infer<
  typeof sendSessionMessageInputSchema
>;
export type ErrorPayloadInput = z.infer<typeof errorPayloadSchema>;
