import { useEffect, useMemo, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  NotificationCapabilitySummary,
  NotificationChannelSummary
} from '@agent-workbench/shared';
import { useForm, useWatch } from 'react-hook-form';

import { toApiRequestError } from '@/api/client';
import { parseRunnerConfigSchema } from '@/lib/runner-config-schema';

import {
  applyNotificationChannelConfigErrors,
  buildNotificationChannelConfigValues,
  buildNotificationChannelFormValues,
  notificationChannelFormSchema,
  parseNotificationChannelFilter,
  type NotificationChannelFormValues,
  validateNotificationChannelConfig
} from '../notification-channel.form';
import {
  useCreateChannel,
  useUpdateChannel
} from './use-notification-channels';

type UseNotificationChannelFormParams = {
  capabilities: NotificationCapabilitySummary[];
  editing?: NotificationChannelSummary;
  onClose: () => void;
  open: boolean;
  scopeId: string;
};

function findNotificationCapability(
  capabilities: NotificationCapabilitySummary[],
  capabilityId?: string
) {
  return capabilities.find((capability) => capability.id === capabilityId);
}

function buildNotificationChannelPayload(
  values: NotificationChannelFormValues,
  config: Record<string, unknown>
) {
  return {
    name: values.name,
    capabilityId: values.capabilityId,
    filter: parseNotificationChannelFilter(values.filterJson),
    enabled: values.enabled,
    config
  };
}

export function useNotificationChannelForm({
  capabilities,
  editing,
  onClose,
  open,
  scopeId
}: UseNotificationChannelFormParams) {
  const initialFormValues = useMemo(
    () => buildNotificationChannelFormValues({ editing, capabilities }),
    [capabilities, editing]
  );
  const isEdit = editing !== undefined;
  const createMutation = useCreateChannel(scopeId);
  const updateMutation = useUpdateChannel(editing?.id ?? '', scopeId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const syncedCapabilityIdRef = useRef<string | undefined>(
    initialFormValues.capabilityId
  );

  const form = useForm<NotificationChannelFormValues>({
    resolver: zodResolver(notificationChannelFormSchema),
    defaultValues: initialFormValues
  });

  const selectedCapabilityId = useWatch({
    control: form.control,
    name: 'capabilityId'
  });
  const selectedCapability = useMemo(
    () => findNotificationCapability(capabilities, selectedCapabilityId),
    [capabilities, selectedCapabilityId]
  );
  const parsedConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedCapability?.configSchema),
    [selectedCapability]
  );

  useEffect(() => {
    if (!open || editing) {
      return;
    }

    const defaultCapabilityId = capabilities[0]?.id ?? '';
    if (form.getValues('capabilityId') || !defaultCapabilityId) {
      return;
    }

    form.setValue('capabilityId', defaultCapabilityId, {
      shouldDirty: false,
      shouldValidate: true
    });
  }, [capabilities, editing, form, open]);

  useEffect(() => {
    if (
      !open ||
      !selectedCapabilityId ||
      selectedCapabilityId === syncedCapabilityIdRef.current
    ) {
      return;
    }

    syncedCapabilityIdRef.current = selectedCapabilityId;

    if (!selectedCapability) {
      form.setValue('config', {}, { shouldDirty: false });
      return;
    }

    const currentConfig = form.getValues('config');
    const nextConfig =
      editing && selectedCapability.id === editing.capabilityId
        ? buildNotificationChannelConfigValues(selectedCapability, editing.config)
        : buildNotificationChannelConfigValues(selectedCapability, currentConfig);

    form.setValue('config', nextConfig, {
      shouldDirty: false,
      shouldValidate: false
    });
  }, [editing, form, open, selectedCapability, selectedCapabilityId]);

  function resetFormState() {
    syncedCapabilityIdRef.current = initialFormValues.capabilityId;
    form.reset(initialFormValues);
    setSubmitError(null);
  }

  function handleClose() {
    resetFormState();
    onClose();
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitError(null);
      form.clearErrors('config');

      const configValidation = validateNotificationChannelConfig(
        selectedCapability,
        values.config
      );

      if (!configValidation.success) {
        applyNotificationChannelConfigErrors(form, configValidation.errors);
        return;
      }

      const payload = buildNotificationChannelPayload(
        values,
        configValidation.config
      );

      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync({
          scopeId,
          ...payload
        });
      }

      handleClose();
    } catch (error) {
      setSubmitError(toApiRequestError(error).message);
    }
  });

  return {
    form,
    handleClose,
    handleSubmit,
    isEdit,
    parsedConfigSchema,
    saveDisabled:
      capabilities.length === 0 ||
      createMutation.isPending ||
      updateMutation.isPending,
    selectedCapability,
    selectedCapabilityId,
    submitError
  };
}
