import { z } from 'zod';

import { mcpConfigOverrideSchema } from './resources';
import {
  MessageRole,
  MessageStatus,
  MetricKind,
  SessionStatus
} from '../types/session';

const idSchema = z.string().trim().min(1);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const sessionStatusSchema = z.nativeEnum(SessionStatus);
export const messageStatusSchema = z.nativeEnum(MessageStatus);
export const messageRoleSchema = z.nativeEnum(MessageRole);
export const metricKindSchema = z.nativeEnum(MetricKind);

export const platformSessionMcpSchema = z.object({
  resourceId: idSchema,
  configOverride: mcpConfigOverrideSchema.optional()
});

export const platformSessionConfigSchema = z.object({
  cwd: z.string().trim().min(1),
  skillIds: z.array(idSchema),
  ruleIds: z.array(idSchema),
  mcps: z.array(platformSessionMcpSchema)
});

export const createSessionInputSchema = z.object({
  scopeId: idSchema,
  runnerId: idSchema,
  skillIds: z.array(idSchema),
  ruleIds: z.array(idSchema),
  mcps: z.array(platformSessionMcpSchema),
  runnerSessionConfig: jsonObjectSchema,
  initialInput: jsonObjectSchema.optional()
});

export const sendSessionMessageInputSchema = z.object({
  input: jsonObjectSchema
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

export const toolUseDataSchema = z.object({
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

export type PlatformSessionConfigInput = z.infer<
  typeof platformSessionConfigSchema
>;
export type CreateSessionInputSchema = z.infer<
  typeof createSessionInputSchema
>;
export type SendSessionMessageInputSchema = z.infer<
  typeof sendSessionMessageInputSchema
>;
export type ErrorPayloadInput = z.infer<typeof errorPayloadSchema>;
