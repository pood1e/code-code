import { z } from 'zod';

export const createChatInputSchema = z.object({
  scopeId: z.string().min(1, 'scopeId must not be empty'),
  runnerId: z.string().min(1, 'runnerId must not be empty'),
  title: z.string().nullable().optional(),
  skillIds: z.array(z.string()).default([]),
  ruleIds: z.array(z.string()).default([]),
  mcps: z
    .array(
      z.object({
        resourceId: z.string().min(1),
        configOverride: z.record(z.string(), z.unknown()).optional()
      })
    )
    .default([]),
  runnerSessionConfig: z.record(z.string(), z.unknown()).default({}),
  initialMessage: z
    .object({
      input: z.record(z.string(), z.unknown()),
      runtimeConfig: z.record(z.string(), z.unknown()).optional()
    })
    .optional()
});

export const updateChatInputSchema = z
  .object({
    title: z.string().nullable().optional()
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    'At least one chat field must be provided'
  );
