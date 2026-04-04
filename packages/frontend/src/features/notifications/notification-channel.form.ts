import { channelFilterSchema } from '@agent-workbench/shared';
import type {
  ChannelFilter,
  NotificationCapabilitySummary,
  NotificationChannelSummary
} from '@agent-workbench/shared';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  buildRunnerConfigInitialValues,
  normalizeRunnerConfigValues,
  parseRunnerConfigSchema
} from '@/lib/runner-config-schema';

export const notificationChannelFormSchema = z.object({
  name: z.string().min(1, '渠道名称不能为空').max(200),
  capabilityId: z.string().min(1, '请选择通知能力'),
  config: z.record(z.string(), z.unknown()),
  filterJson: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        channelFilterSchema.parse(JSON.parse(value) as unknown);
        return true;
      } catch {
        return false;
      }
    }, { message: '必须是合法 JSON，且包含 messageTypes 数组' }),
  enabled: z.boolean()
});

export type NotificationChannelFormValues = z.infer<
  typeof notificationChannelFormSchema
>;

type BuildNotificationChannelFormValuesOptions = {
  editing?: NotificationChannelSummary;
  capabilities: NotificationCapabilitySummary[];
};

export type NotificationChannelConfigValidationResult =
  | {
      success: true;
      config: Record<string, unknown>;
    }
  | {
      success: false;
      errors: Record<string, string>;
    };

function toNotificationChannelFormValues(
  channel: NotificationChannelSummary
): NotificationChannelFormValues {
  return {
    name: channel.name,
    capabilityId: channel.capabilityId,
    config: channel.config,
    filterJson: JSON.stringify(channel.filter, null, 2),
    enabled: channel.enabled
  };
}

export function buildNotificationChannelConfigValues(
  capability: NotificationCapabilitySummary | undefined,
  source?: Record<string, unknown>
): Record<string, unknown> {
  const parsedConfigSchema = parseRunnerConfigSchema(capability?.configSchema);
  if (!parsedConfigSchema.supported) {
    return source ?? {};
  }

  return buildRunnerConfigInitialValues(parsedConfigSchema.fields, source);
}

function buildCreateNotificationChannelFormValues(
  capabilities: NotificationCapabilitySummary[]
): NotificationChannelFormValues {
  const defaultCapability = capabilities[0];

  return {
    name: '',
    capabilityId: defaultCapability?.id ?? '',
    config: buildNotificationChannelConfigValues(defaultCapability),
    filterJson: JSON.stringify({ messageTypes: ['session.*'] }, null, 2),
    enabled: true
  };
}

export function buildNotificationChannelFormValues({
  editing,
  capabilities
}: BuildNotificationChannelFormValuesOptions): NotificationChannelFormValues {
  return editing
    ? toNotificationChannelFormValues(editing)
    : buildCreateNotificationChannelFormValues(capabilities);
}

export function parseNotificationChannelFilter(value: string): ChannelFilter {
  return channelFilterSchema.parse(JSON.parse(value) as unknown);
}

function toNotificationChannelConfigErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
) {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const fieldName = issue.path[0];
    if (typeof fieldName === 'string') {
      errors[fieldName] = issue.message;
    }
  }

  return errors;
}

export function validateNotificationChannelConfig(
  capability: NotificationCapabilitySummary | undefined,
  config: Record<string, unknown>
): NotificationChannelConfigValidationResult {
  const parsedConfigSchema = parseRunnerConfigSchema(capability?.configSchema);

  if (!parsedConfigSchema.supported) {
    return {
      success: true,
      config
    };
  }

  const normalizedConfig = normalizeRunnerConfigValues(
    parsedConfigSchema.fields,
    config
  );
  const validationResult =
    parsedConfigSchema.validationSchema.safeParse(normalizedConfig);

  if (!validationResult.success) {
    return {
      success: false,
      errors: toNotificationChannelConfigErrors(validationResult.error.issues)
    };
  }

  return {
    success: true,
    config: validationResult.data
  };
}

export function applyNotificationChannelConfigErrors(
  form: UseFormReturn<NotificationChannelFormValues>,
  errors: Record<string, string>
) {
  for (const [fieldName, message] of Object.entries(errors)) {
    form.setError(`config.${fieldName}` as `config.${string}`, {
      message
    });
  }
}
