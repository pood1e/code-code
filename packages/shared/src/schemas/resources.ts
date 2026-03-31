import { z } from 'zod';

const resourceMetaSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional()
});

export const stringMapSchema = z.record(z.string(), z.string());

export const markdownContentSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, 'Content is required');

export const mcpContentSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().trim().min(1),
  args: z.array(z.string().trim().min(1)),
  env: stringMapSchema.optional()
});

export const mcpConfigOverrideSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().trim().min(1).optional(),
  args: z.array(z.string().trim().min(1)).optional(),
  env: stringMapSchema.optional()
});

export const skillInputSchema = resourceMetaSchema.extend({
  content: markdownContentSchema
});

export const ruleInputSchema = resourceMetaSchema.extend({
  content: markdownContentSchema
});

export const mcpInputSchema = resourceMetaSchema.extend({
  content: mcpContentSchema
});

export const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional()
});

export const profileItemInputSchema = z.object({
  resourceId: z.string().trim().min(1),
  order: z.number().int().min(0)
});

export const mcpProfileItemInputSchema = profileItemInputSchema.extend({
  configOverride: mcpConfigOverrideSchema.optional()
});

export const profileItemsPayloadSchema = z.object({
  skills: z.array(profileItemInputSchema),
  mcps: z.array(mcpProfileItemInputSchema),
  rules: z.array(profileItemInputSchema)
});

export type SkillInput = z.infer<typeof skillInputSchema>;
export type RuleInput = z.infer<typeof ruleInputSchema>;
export type McpContentInput = z.infer<typeof mcpContentSchema>;
export type McpInput = z.infer<typeof mcpInputSchema>;
export type McpConfigOverrideInput = z.infer<typeof mcpConfigOverrideSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileItemsPayloadInput = z.infer<
  typeof profileItemsPayloadSchema
>;
