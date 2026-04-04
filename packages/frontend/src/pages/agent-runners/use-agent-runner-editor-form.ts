import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RunnerTypeResponse } from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  createAgentRunner,
  updateAgentRunner
} from '@/api/agent-runners';
import { queryKeys } from '@/query/query-keys';
import { agentRunnerConfig } from '@/types/agent-runners';

import {
  agentRunnerEditorFormSchema,
  buildCreateAgentRunnerInput,
  buildRunnerConfigInitialValues,
  buildUpdateAgentRunnerInput,
  normalizeRunnerConfigValues,
  type ParsedRunnerConfigSchema,
  parseRawRunnerConfigText,
  parseRunnerConfigSchema,
  stringifyRunnerConfig,
  type AgentRunnerEditorFormValues
} from './agent-runner.form';

const rawRunnerConfigFallbackError = 'Runner Config 校验失败';

class RunnerConfigValidationError extends Error {
  constructor(readonly rawRunnerConfigError: string | null = null) {
    super('Runner Config 校验失败');
  }
}

type UseAgentRunnerEditorFormParams = {
  initialValues: AgentRunnerEditorFormValues;
  runnerId?: string;
  runnerTypes: RunnerTypeResponse[];
};

export function useAgentRunnerEditorForm({
  initialValues,
  runnerId,
  runnerTypes
}: UseAgentRunnerEditorFormParams) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rawRunnerConfigText, setRawRunnerConfigText] = useState(() =>
    stringifyRunnerConfig(initialValues.runnerConfig)
  );
  const [rawRunnerConfigError, setRawRunnerConfigError] = useState<
    string | null
  >(null);
  const isEditing = Boolean(runnerId);

  const form = useForm<AgentRunnerEditorFormValues>({
    resolver: zodResolver(agentRunnerEditorFormSchema),
    defaultValues: initialValues
  });

  useEffect(() => {
    form.reset(initialValues);
    setRawRunnerConfigText(stringifyRunnerConfig(initialValues.runnerConfig));
    setRawRunnerConfigError(null);
    setSubmitError(null);
  }, [form, initialValues]);

  const selectedTypeId = useWatch({
    control: form.control,
    name: 'type'
  });
  const selectedRunnerType = useMemo(
    () => runnerTypes.find((runnerType) => runnerType.id === selectedTypeId),
    [runnerTypes, selectedTypeId]
  );
  const parsedSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.runnerConfigSchema),
    [selectedRunnerType]
  );

  const saveMutation = useMutation({
    mutationFn: (values: AgentRunnerEditorFormValues) =>
      saveAgentRunner({
        form,
        isEditing,
        parsedSchema,
        rawRunnerConfigText,
        runnerId,
        values
      }),
    onSuccess: async (savedAgentRunner) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentRunners.all
        }),
        queryClient.setQueryData(
          queryKeys.agentRunners.detail(savedAgentRunner.id),
          savedAgentRunner
        )
      ]);
      void navigate(agentRunnerConfig.path);
    }
  });

  const handleTypeChange = (nextTypeId: string) => {
    const nextRunnerType = runnerTypes.find(
      (runnerType) => runnerType.id === nextTypeId
    );
    const nextSchema = parseRunnerConfigSchema(
      nextRunnerType?.runnerConfigSchema
    );
    const nextRunnerConfig =
      nextSchema.supported && nextRunnerType
        ? buildRunnerConfigInitialValues(nextSchema.fields)
        : {};

    form.reset({
      ...form.getValues(),
      type: nextTypeId,
      runnerConfig: nextRunnerConfig
    });
    setRawRunnerConfigText(stringifyRunnerConfig(nextRunnerConfig));
    setRawRunnerConfigError(null);
    setSubmitError(null);
  };

  const handleRawRunnerConfigChange = (nextValue: string) => {
    setRawRunnerConfigText(nextValue);
    setRawRunnerConfigError(null);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setRawRunnerConfigError(null);
    form.clearErrors();

    try {
      await saveMutation.mutateAsync(values);
    } catch (error) {
      if (error instanceof RunnerConfigValidationError) {
        setRawRunnerConfigError(error.rawRunnerConfigError);
        return;
      }

      setSubmitError(error instanceof Error ? error.message : '保存失败');
    }
  });

  return {
    form,
    handleRawRunnerConfigChange,
    handleSave,
    handleTypeChange,
    isEditing,
    parsedSchema,
    rawRunnerConfigError,
    rawRunnerConfigText,
    saveDisabled: saveMutation.isPending || !selectedRunnerType,
    selectedRunnerType,
    selectedTypeId,
    submitError
  };
}

type SaveAgentRunnerParams = {
  form: ReturnType<typeof useForm<AgentRunnerEditorFormValues>>;
  isEditing: boolean;
  parsedSchema: ParsedRunnerConfigSchema;
  rawRunnerConfigText: string;
  runnerId?: string;
  values: AgentRunnerEditorFormValues;
};

async function saveAgentRunner({
  form,
  isEditing,
  parsedSchema,
  rawRunnerConfigText,
  runnerId,
  values
}: SaveAgentRunnerParams) {
  if (parsedSchema.supported) {
    const runnerConfig = normalizeRunnerConfigValues(
      parsedSchema.fields,
      values.runnerConfig ?? {}
    );
    const validationResult =
      parsedSchema.validationSchema.safeParse(runnerConfig);

    if (!validationResult.success) {
      for (const issue of validationResult.error.issues) {
        const fieldName = issue.path[0];
        if (typeof fieldName === 'string') {
          form.setError(`runnerConfig.${fieldName}`, {
            message: issue.message
          });
        }
      }

      throw new RunnerConfigValidationError();
    }

    return persistAgentRunner({
      isEditing,
      runnerConfig: validationResult.data,
      runnerId,
      values
    });
  }

  const rawRunnerConfigResult = parseRawRunnerConfigText(rawRunnerConfigText);
  if (!rawRunnerConfigResult.data) {
    throw new RunnerConfigValidationError(
      rawRunnerConfigResult.error ?? rawRunnerConfigFallbackError
    );
  }

  return persistAgentRunner({
    isEditing,
    runnerConfig: rawRunnerConfigResult.data,
    runnerId,
    values
  });
}

function persistAgentRunner({
  isEditing,
  runnerConfig,
  runnerId,
  values
}: {
  isEditing: boolean;
  runnerConfig: Record<string, unknown>;
  runnerId?: string;
  values: AgentRunnerEditorFormValues;
}) {
  if (isEditing && runnerId) {
    return updateAgentRunner(
      runnerId,
      buildUpdateAgentRunnerInput(values, runnerConfig)
    );
  }

  return createAgentRunner(buildCreateAgentRunnerInput(values, runnerConfig));
}
