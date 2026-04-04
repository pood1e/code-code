import { z } from 'zod';

import {
  FieldMatchOperator,
  NotificationTaskStatus,
} from '../types/notification';

// ─── FieldMatcher ─────────────────────────────────────────────────────────────

export const fieldMatchOperatorSchema = z.nativeEnum(FieldMatchOperator);

export const fieldMatcherSchema = z
  .object({
    field: z.string().trim().min(1).max(100),
    operator: fieldMatchOperatorSchema,
    values: z.array(z.string()).optional(),
  })
  .refine(
    (m) => {
      switch (m.operator) {
        case FieldMatchOperator.In:
        case FieldMatchOperator.NotIn:
          return m.values != null && m.values.length > 0;
        case FieldMatchOperator.Prefix:
        case FieldMatchOperator.Suffix:
          return m.values != null && m.values.length === 1;
        case FieldMatchOperator.Exists:
        case FieldMatchOperator.DoesNotExist:
          return m.values == null || m.values.length === 0;
        default:
          return false;
      }
    },
    { message: 'values must match the operator requirements' }
  );

// ─── ChannelFilter ────────────────────────────────────────────────────────────

export const channelFilterSchema = z.object({
  eventTypes: z.array(z.string().trim().min(1).max(100)).min(1),
  conditions: z.array(fieldMatcherSchema).optional(),
});

// ─── Channel CRUD ─────────────────────────────────────────────────────────────

export const createNotificationChannelInputSchema = z.object({
  scopeId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  channelType: z.string().trim().min(1).max(50),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  filter: channelFilterSchema,
  enabled: z.boolean().optional().default(true),
});

export const updateNotificationChannelInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    channelType: z.string().trim().min(1).max(50).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    filter: channelFilterSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.channelType !== undefined ||
      v.config !== undefined ||
      v.filter !== undefined ||
      v.enabled !== undefined,
    { message: 'At least one field must be provided for update' }
  );

// ─── Event receive ────────────────────────────────────────────────────────────

export const notificationEventInputSchema = z.object({
  scopeId: z.string().trim().min(1),
  eventType: z.string().trim().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
});

// ─── Task status ──────────────────────────────────────────────────────────────

export const notificationTaskStatusSchema = z.nativeEnum(NotificationTaskStatus);
