import { useEffect, useMemo, type KeyboardEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type {
  AgentRunnerDetail,
  AgentRunnerSummary,
  RunnerTypeResponse
} from '@agent-workbench/shared';

import type { getProfile } from '@/api/profiles';
import {
  buildAdditionalInputInitialValues,
  getAdditionalInputFields,
  getPrimaryInputField
} from '@/features/chat/runtime/assistant-ui/input-schema';
import {
  buildRunnerConfigInitialValues,
  parseRunnerConfigSchema,
  type RunnerConfigField
} from '@/lib/runner-config-schema';
import type { CreateSessionFormValues } from '@/pages/projects/project-sessions.form';

export function useCreateSessionFieldValues(
  control: ReturnType<typeof useForm<CreateSessionFormValues>>['control']
) {
  return {
    selectedRunnerId: useWatch({
      control,
      name: 'runnerId'
    }),
    selectedProfileId: useWatch({
      control,
      name: 'profileId'
    }),
    selectedWorkspaceResources: useWatch({
      control,
      name: 'workspaceResources'
    }),
    selectedSkillIds: useWatch({
      control,
      name: 'skillIds'
    }),
    selectedRuleIds: useWatch({
      control,
      name: 'ruleIds'
    }),
    selectedMcpIds: useWatch({
      control,
      name: 'mcpIds'
    }),
    initialMessageText: useWatch({
      control,
      name: 'initialMessageText'
    }),
    initialRawInput: useWatch({
      control,
      name: 'initialRawInput'
    })
  };
}

export function useCreateSessionSchemaState(
  selectedRunnerType: RunnerTypeResponse | undefined,
  selectedRunnerConfig?: Record<string, unknown>
) {
  const sessionConfigSchema = useMemo(
    () =>
      parseRunnerConfigSchema(selectedRunnerType?.runnerSessionConfigSchema),
    [selectedRunnerType?.runnerSessionConfigSchema]
  );
  const inputConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.inputSchema),
    [selectedRunnerType?.inputSchema]
  );
  const runtimeConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.runtimeConfigSchema),
    [selectedRunnerType?.runtimeConfigSchema]
  );
  const structuredInputSchema = inputConfigSchema.supported
    ? inputConfigSchema
    : undefined;
  const structuredRuntimeSchema = runtimeConfigSchema.supported
    ? runtimeConfigSchema
    : undefined;
  const runtimeFields = useMemo(
    () =>
      getRuntimeFieldsForRunner(
        selectedRunnerType?.id,
        selectedRunnerConfig,
        structuredRuntimeSchema?.fields ?? []
      ),
    [selectedRunnerConfig, selectedRunnerType?.id, structuredRuntimeSchema]
  );
  const primaryInputField = useMemo(() => {
    if (!structuredInputSchema) {
      return undefined;
    }

    return getPrimaryInputField(structuredInputSchema.fields);
  }, [structuredInputSchema]);
  const additionalInputFields = useMemo(() => {
    if (!structuredInputSchema) {
      return [];
    }

    return getAdditionalInputFields(structuredInputSchema, primaryInputField);
  }, [primaryInputField, structuredInputSchema]);

  return {
    additionalInputFields,
    primaryInputField,
    runtimeFields,
    sessionConfigSchema,
    structuredInputSchema,
    structuredRuntimeSchema,
    supportsStructuredInitialInput: Boolean(
      structuredInputSchema && primaryInputField
    )
  };
}

export function useInitialRunnerSelection(
  form: ReturnType<typeof useForm<CreateSessionFormValues>>,
  runners: AgentRunnerSummary[],
  selectedRunnerId: string
) {
  useEffect(() => {
    if (runners.length === 0 || selectedRunnerId) {
      return;
    }

    form.setValue('runnerId', runners[0].id);
  }, [form, runners, selectedRunnerId]);
}

export function useRunnerFormDefaults(
  form: ReturnType<typeof useForm<CreateSessionFormValues>>,
  selectedRunnerTypeId: string | undefined,
  selectedRunnerConfig: Record<string, unknown> | undefined,
  schemaState: ReturnType<typeof useCreateSessionSchemaState>
) {
  useEffect(() => {
    form.setValue(
      'runnerSessionConfig',
      schemaState.sessionConfigSchema.supported
        ? buildRunnerConfigInitialValues(
            schemaState.sessionConfigSchema.fields
          )
        : {}
    );
  }, [form, schemaState.sessionConfigSchema, selectedRunnerTypeId]);

  useEffect(() => {
    form.setValue(
      'initialInputConfig',
      schemaState.structuredInputSchema
        ? buildAdditionalInputInitialValues(schemaState.additionalInputFields)
        : {}
    );
    form.setValue(
      'initialRuntimeConfig',
      buildRuntimeInitialValuesForRunner(
        schemaState.runtimeFields,
        selectedRunnerTypeId,
        selectedRunnerConfig
      )
    );
    form.setValue('initialMessageText', '');
    form.setValue('initialRawInput', '');
  }, [
    form,
    schemaState.additionalInputFields,
    schemaState.runtimeFields,
    schemaState.structuredInputSchema,
    selectedRunnerConfig,
    selectedRunnerTypeId
  ]);
}

function getRuntimeFieldsForRunner(
  runnerTypeId: string | undefined,
  runnerConfig: Record<string, unknown> | undefined,
  fields: RunnerConfigField[]
) {
  if (runnerTypeId !== 'claude-code' || !runnerConfig) {
    return fields;
  }

  return fields.filter((field) => {
    if (
      field.name === 'model' &&
      runnerConfig.allowRuntimeModelOverride === false
    ) {
      return false;
    }

    if (
      field.name === 'permissionMode' &&
      runnerConfig.allowRuntimePermissionModeOverride === false
    ) {
      return false;
    }

    return true;
  });
}

function buildRuntimeInitialValuesForRunner(
  fields: RunnerConfigField[],
  runnerTypeId: string | undefined,
  runnerConfig: Record<string, unknown> | undefined
) {
  const initialValues = buildAdditionalInputInitialValues(fields);

  if (runnerTypeId !== 'claude-code' || !runnerConfig) {
    return initialValues;
  }

  if (
    fields.some((field) => field.name === 'model') &&
    typeof runnerConfig.defaultRuntimeModel === 'string'
  ) {
    initialValues.model = runnerConfig.defaultRuntimeModel;
  }

  if (
    fields.some((field) => field.name === 'permissionMode') &&
    typeof runnerConfig.defaultRuntimePermissionMode === 'string'
  ) {
    initialValues.permissionMode = runnerConfig.defaultRuntimePermissionMode;
  }

  return initialValues;
}

export function getSelectedRunnerConfig(
  selectedRunnerDetail: AgentRunnerDetail | undefined
) {
  return selectedRunnerDetail?.runnerConfig;
}

export function useProfileResourceDefaults(
  form: ReturnType<typeof useForm<CreateSessionFormValues>>,
  selectedProfileId: string | undefined,
  profileDetail: Awaited<ReturnType<typeof getProfile>> | undefined
) {
  useEffect(() => {
    if (!selectedProfileId || !profileDetail) {
      return;
    }

    form.setValue(
      'skillIds',
      profileDetail.skills.map((item) => item.id)
    );
    form.setValue(
      'ruleIds',
      profileDetail.rules.map((item) => item.id)
    );
    form.setValue(
      'mcpIds',
      profileDetail.mcps.map((item) => item.id)
    );
  }, [form, profileDetail, selectedProfileId]);
}

export function getHasInitialMessageDraft({
  supportsStructuredInitialInput,
  initialMessageText,
  initialRawInput
}: {
  supportsStructuredInitialInput: boolean;
  initialMessageText?: string;
  initialRawInput?: string;
}) {
  return supportsStructuredInitialInput
    ? (initialMessageText?.trim().length ?? 0) > 0
    : (initialRawInput?.trim().length ?? 0) > 0;
}

export function shouldSubmitStructuredPromptByEnter(
  event: KeyboardEvent<HTMLTextAreaElement>,
  supportsStructuredInitialInput: boolean
) {
  return (
    supportsStructuredInitialInput &&
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing
  );
}

export function isCreateSessionValidationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === 'Session 配置校验失败' ||
      error.message === '首条消息输入校验失败' ||
      error.message === '首条消息运行时参数校验失败')
  );
}
