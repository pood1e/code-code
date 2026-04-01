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

type ProfileItemsListEntry =
  | z.infer<typeof profileItemInputSchema>
  | z.infer<typeof mcpProfileItemInputSchema>;

function validateProfileItemsList(
  items: ProfileItemsListEntry[],
  ctx: z.RefinementCtx
) {
  const resourceIds = new Set<string>();
  const orders = new Set<number>();

  items.forEach((item, index) => {
    const { resourceId, order } = item;

    if (resourceIds.has(resourceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate resourceId: ${resourceId}`,
        path: [index, 'resourceId']
      });
    }

    if (orders.has(order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate order: ${order}`,
        path: [index, 'order']
      });
    }

    if (order !== index) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Order must match the array position',
        path: [index, 'order']
      });
    }

    resourceIds.add(resourceId);
    orders.add(order);
  });
}

const profileItemsListSchema = z
  .array(profileItemInputSchema)
  .superRefine(validateProfileItemsList);
const mcpProfileItemsListSchema = z
  .array(mcpProfileItemInputSchema)
  .superRefine(validateProfileItemsList);

export const profileItemsPayloadSchema = z.object({
  skills: profileItemsListSchema,
  mcps: mcpProfileItemsListSchema,
  rules: profileItemsListSchema
});

export const saveProfileInputSchema = profileInputSchema.extend({
  skills: profileItemsPayloadSchema.shape.skills,
  mcps: profileItemsPayloadSchema.shape.mcps,
  rules: profileItemsPayloadSchema.shape.rules
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
export type SaveProfileInput = z.infer<typeof saveProfileInputSchema>;
