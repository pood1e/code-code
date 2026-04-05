import { useMemo, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AgentRunnerSummary,
  ChatSummary,
  Profile,
  ResourceByKind,
  RunnerTypeResponse,
  SessionWorkspaceResourceKind
} from '@agent-workbench/shared';

import { probeAgentRunnerContext } from '@/api/agent-runners';
import { toApiRequestError } from '@/api/client';
import { getProfile } from '@/api/profiles';
import { useErrorMessage } from '@/hooks/use-error-message';
import {
  buildCreateSessionFormValues,
  createSessionFormSchema,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.form';
import { NOOP_QUERY_KEY, queryKeys } from '@/query/query-keys';

import { useCreateSessionMutation } from '../hooks/use-create-session-mutation';

import {
  getHasInitialMessageDraft,
  isCreateSessionValidationError,
  shouldSubmitStructuredPromptByEnter,
  useCreateSessionFieldValues,
  useCreateSessionSchemaState,
  useInitialRunnerSelection,
  useProfileResourceDefaults,
  useRunnerFormDefaults
} from './create-session-panel.state';

export type CreateSessionResources = {
  skills: ResourceByKind['skills'][];
  mcps: ResourceByKind['mcps'][];
  rules: ResourceByKind['rules'][];
};

export function useCreateSessionPanelState({
  projectId,
  runnerTypes,
  runners,
  onCreated
}: {
  projectId: string;
  runnerTypes: RunnerTypeResponse[];
  runners: AgentRunnerSummary[];
  onCreated: (chat: ChatSummary) => void;
}) {
  const handleError = useErrorMessage();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionFormSchema),
    defaultValues: buildCreateSessionFormValues()
  });

  const fieldValues = useCreateSessionFieldValues(form.control);
  const selectedRunner = useMemo(
    () => runners.find((runner) => runner.id === fieldValues.selectedRunnerId),
    [runners, fieldValues.selectedRunnerId]
  );
  const selectedRunnerType = useMemo(
    () =>
      runnerTypes.find((runnerType) => runnerType.id === selectedRunner?.type),
    [runnerTypes, selectedRunner?.type]
  );
  const schemaState = useCreateSessionSchemaState(selectedRunnerType);
  const profileDetailQuery = useProfileDetailQuery(fieldValues.selectedProfileId);
  const { data: runnerContext } = useRunnerContextQuery(
    fieldValues.selectedRunnerId
  );
  const createMutation = useCreateSessionMutation({
    projectId,
    form,
    sessionConfigSchema: schemaState.sessionConfigSchema,
    structuredInputSchema: schemaState.structuredInputSchema,
    structuredRuntimeSchema: schemaState.structuredRuntimeSchema,
    primaryInputField: schemaState.primaryInputField,
    supportsStructuredInitialInput: schemaState.supportsStructuredInitialInput,
    profileDetail: profileDetailQuery.data,
    onCreated
  });

  useInitialRunnerSelection(form, runners, fieldValues.selectedRunnerId);
  useRunnerFormDefaults(form, selectedRunnerType?.id, schemaState);
  useProfileResourceDefaults(
    form,
    fieldValues.selectedProfileId,
    profileDetailQuery.data
  );

  const hasInitialMessageDraft = getHasInitialMessageDraft({
    supportsStructuredInitialInput: schemaState.supportsStructuredInitialInput,
    initialMessageText: fieldValues.initialMessageText,
    initialRawInput: fieldValues.initialRawInput
  });

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(values);
    } catch (error) {
      if (isCreateSessionValidationError(error)) {
        return;
      }

      const apiError = toApiRequestError(error);
      setSubmitError(apiError.message);
      handleError(error);
    }
  });

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldSubmitStructuredPromptByEnter(event, schemaState.supportsStructuredInitialInput)) {
      return;
    }

    event.preventDefault();

    if (createMutation.isPending || !hasInitialMessageDraft) {
      return;
    }

    void submit();
  };

  const toggleSelection = (
    fieldName: 'workspaceResources' | 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => {
    if (fieldName === 'workspaceResources') {
      const typedResourceId = resourceId as SessionWorkspaceResourceKind;
      const currentValue = form.getValues('workspaceResources');
      const nextValue = currentValue.includes(typedResourceId)
        ? currentValue.filter((id) => id !== typedResourceId)
        : [...currentValue, typedResourceId];

      form.setValue('workspaceResources', nextValue, {
        shouldDirty: true
      });
      return;
    }

    const currentValue = form.getValues(fieldName);
    const nextValue = currentValue.includes(resourceId)
      ? currentValue.filter((id) => id !== resourceId)
      : [...currentValue, resourceId];

    form.setValue(fieldName, nextValue, {
      shouldDirty: true
    });
  };

  return {
    form,
    advancedOpen,
    submitError,
    selectedRunnerId: fieldValues.selectedRunnerId,
    selectedProfileId: fieldValues.selectedProfileId,
    selectedWorkspaceResources: fieldValues.selectedWorkspaceResources,
    selectedSkillIds: fieldValues.selectedSkillIds,
    selectedRuleIds: fieldValues.selectedRuleIds,
    selectedMcpIds: fieldValues.selectedMcpIds,
    sessionConfigSchema: schemaState.sessionConfigSchema,
    runtimeFields: schemaState.runtimeFields,
    additionalInputFields: schemaState.additionalInputFields,
    supportsStructuredInitialInput: schemaState.supportsStructuredInitialInput,
    hasInitialMessageDraft,
    runnerContext,
    isCreating: createMutation.isPending,
    setAdvancedOpen,
    toggleSelection,
    submit,
    handlePromptKeyDown
  };
}

function useProfileDetailQuery(selectedProfileId: string | undefined) {
  return useQuery({
    queryKey: selectedProfileId
      ? queryKeys.profiles.detail(selectedProfileId)
      : NOOP_QUERY_KEY,
    queryFn: () => getProfile(selectedProfileId!),
    enabled: Boolean(selectedProfileId)
  });
}

function useRunnerContextQuery(selectedRunnerId: string | undefined) {
  return useQuery({
    queryKey: selectedRunnerId
      ? queryKeys.agentRunners.context(selectedRunnerId)
      : NOOP_QUERY_KEY,
    queryFn: () => probeAgentRunnerContext(selectedRunnerId!),
    enabled: Boolean(selectedRunnerId),
    staleTime: 60 * 1000
  });
}
