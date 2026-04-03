import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  buildAdditionalInputInitialValues,
  getAdditionalInputFields,
  getPrimaryInputField
} from '@/features/chat/runtime/assistant-ui/input-schema';
import {
  buildRunnerConfigInitialValues,
  parseRunnerConfigSchema
} from '@/lib/runner-config-schema';
import {
  buildCreateSessionFormValues,
  createSessionFormSchema,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.form';
import { getProfile } from '@/api/profiles';
import { probeAgentRunnerContext } from '@/api/agent-runners';
import { toApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { useCreateSessionMutation } from '../hooks/use-create-session-mutation';
import { DynamicConfigFieldInput } from '../components/DynamicConfigFieldInput';
import { ResourceSelectionSection } from '../components/ResourceSelectionSection';
import { SetupSection } from '../components/SetupSection';
import {
  MessageComposerError,
  MessageComposerFooterActions,
  MessageComposerField,
  MessageComposerInputArea,
  MessageComposerShell
} from '@/components/app/MessageComposer';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { ChevronDown, LoaderCircle, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AgentRunnerSummary,
  Profile,
  ResourceByKind,
  RunnerTypeResponse,
  SessionDetail
} from '@agent-workbench/shared';

export function CreateSessionPanel({
  projectId,
  runnerTypes,
  runners,
  profiles,
  resources,
  canCancel,
  onCancel,
  onCreated
}: {
  projectId: string;
  runnerTypes: RunnerTypeResponse[];
  runners: AgentRunnerSummary[];
  profiles: Profile[];
  resources: {
    skills: ResourceByKind['skills'][];
    mcps: ResourceByKind['mcps'][];
    rules: ResourceByKind['rules'][];
  };
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (session: SessionDetail) => void;
}) {
  const handleError = useErrorMessage();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<CreateSessionFormValues>({
    resolver: zodResolver(createSessionFormSchema),
    defaultValues: buildCreateSessionFormValues()
  });
  const selectedRunnerId = useWatch({
    control: form.control,
    name: 'runnerId'
  });
  const selectedProfileId = useWatch({
    control: form.control,
    name: 'profileId'
  });
  const selectedSkillIds = useWatch({
    control: form.control,
    name: 'skillIds'
  });
  const selectedRuleIds = useWatch({
    control: form.control,
    name: 'ruleIds'
  });
  const selectedMcpIds = useWatch({
    control: form.control,
    name: 'mcpIds'
  });
  const initialMessageText = useWatch({
    control: form.control,
    name: 'initialMessageText'
  });
  const initialRawInput = useWatch({
    control: form.control,
    name: 'initialRawInput'
  });

  const selectedRunner = useMemo(
    () => runners.find((runner) => runner.id === selectedRunnerId),
    [runners, selectedRunnerId]
  );
  const selectedRunnerType = useMemo(
    () =>
      runnerTypes.find((runnerType) => runnerType.id === selectedRunner?.type),
    [runnerTypes, selectedRunner?.type]
  );
  const sessionConfigSchema = useMemo(
    () =>
      parseRunnerConfigSchema(selectedRunnerType?.runnerSessionConfigSchema),
    [selectedRunnerType]
  );
  const inputConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.inputSchema),
    [selectedRunnerType]
  );
  const structuredInputSchema = inputConfigSchema.supported
    ? inputConfigSchema
    : undefined;

  const runtimeConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.runtimeConfigSchema),
    [selectedRunnerType]
  );
  const structuredRuntimeSchema = runtimeConfigSchema.supported
    ? runtimeConfigSchema
    : undefined;
  const runtimeFields = useMemo(
    () => structuredRuntimeSchema?.fields ?? [],
    [structuredRuntimeSchema]
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
  const supportsStructuredInitialInput = Boolean(
    structuredInputSchema && primaryInputField
  );
  const hasInitialMessageDraft = supportsStructuredInitialInput
    ? (initialMessageText?.trim().length ?? 0) > 0
    : (initialRawInput?.trim().length ?? 0) > 0;

  const profileDetailQuery = useQuery({
    queryKey: selectedProfileId
      ? queryKeys.profiles.detail(selectedProfileId)
      : queryKeys.profiles.list(),
    queryFn: () => getProfile(selectedProfileId!),
    enabled: Boolean(selectedProfileId)
  });

  const { data: runnerContext } = useQuery({
    queryKey: selectedRunnerId
      ? queryKeys.agentRunners.context(selectedRunnerId)
      : ['agent-runners', 'context', 'empty'],
    queryFn: () => probeAgentRunnerContext(selectedRunnerId!),
    enabled: Boolean(selectedRunnerId),
    staleTime: 60 * 1000
  });

  useEffect(() => {
    if (runners.length > 0 && !selectedRunnerId) {
      form.setValue('runnerId', runners[0].id);
    }
  }, [form, runners, selectedRunnerId]);

  useEffect(() => {
    if (!sessionConfigSchema.supported) {
      form.setValue('runnerSessionConfig', {});
      return;
    }

    form.setValue(
      'runnerSessionConfig',
      buildRunnerConfigInitialValues(sessionConfigSchema.fields)
    );
  }, [form, selectedRunnerType?.id, sessionConfigSchema]);

  useEffect(() => {
    if (!structuredInputSchema) {
      form.setValue('initialInputConfig', {});
      form.setValue(
        'initialRuntimeConfig',
        buildAdditionalInputInitialValues(runtimeFields)
      );
      form.setValue('initialMessageText', '');
      form.setValue('initialRawInput', '');
      return;
    }

    form.setValue(
      'initialInputConfig',
      buildAdditionalInputInitialValues(additionalInputFields)
    );
    form.setValue(
      'initialRuntimeConfig',
      buildAdditionalInputInitialValues(runtimeFields)
    );
    form.setValue('initialMessageText', '');
    form.setValue('initialRawInput', '');
  }, [
    additionalInputFields,
    runtimeFields,
    form,
    selectedRunnerType?.id,
    structuredInputSchema
  ]);

  useEffect(() => {
    if (!selectedProfileId || !profileDetailQuery.data) {
      return;
    }

    form.setValue(
      'skillIds',
      profileDetailQuery.data.skills.map((item) => item.id)
    );
    form.setValue(
      'ruleIds',
      profileDetailQuery.data.rules.map((item) => item.id)
    );
    form.setValue(
      'mcpIds',
      profileDetailQuery.data.mcps.map((item) => item.id)
    );
  }, [form, profileDetailQuery.data, selectedProfileId]);

  const createMutation = useCreateSessionMutation({
    projectId,
    form,
    sessionConfigSchema,
    structuredInputSchema,
    structuredRuntimeSchema,
    primaryInputField,
    supportsStructuredInitialInput,
    profileDetail: profileDetailQuery.data,
    onCreated
  });

  const toggleSelection = (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => {
    const currentValue = form.getValues(fieldName);
    const nextValue = currentValue.includes(resourceId)
      ? currentValue.filter((id) => id !== resourceId)
      : [...currentValue, resourceId];
    form.setValue(fieldName, nextValue, {
      shouldDirty: true
    });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(values);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Session 配置校验失败' ||
          error.message === '首条消息输入校验失败' ||
          error.message === '首条消息运行时参数校验失败')
      ) {
        return;
      }
      const apiError = toApiRequestError(error);
      setSubmitError(apiError.message);
      handleError(error);
    }
  });

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!supportsStructuredInitialInput) {
      return;
    }

    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();

    if (createMutation.isPending || !hasInitialMessageDraft) {
      return;
    }

    void handleSubmit();
  };

  return (
    <div className="flex min-h-[36rem] flex-col xl:min-h-[calc(100vh-14rem)]">
      <div className="flex flex-1 flex-col px-2 py-2 sm:px-4 sm:py-4">
        {submitError ? (
          <MessageComposerError title="创建失败" message={submitError} />
        ) : null}

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pt-4 sm:pt-6">
          <MessageComposerShell
            header={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CompactNativeSelect
                    aria-label="选择 AgentRunner"
                    containerClassName="min-w-[8.75rem]"
                    className="w-full whitespace-nowrap bg-background/70"
                    value={selectedRunnerId}
                    onChange={(event) =>
                      form.setValue('runnerId', event.target.value)
                    }
                  >
                    {runners.map((runner) => (
                      <option key={runner.id} value={runner.id}>
                        {runner.name}
                      </option>
                    ))}
                  </CompactNativeSelect>

                  <CompactNativeSelect
                    aria-label="选择 Profile"
                    containerClassName="min-w-[8.25rem]"
                    className="w-full whitespace-nowrap bg-background/70"
                    value={selectedProfileId ?? ''}
                    onChange={(event) =>
                      form.setValue('profileId', event.target.value)
                    }
                  >
                    <option value="">Profile</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </CompactNativeSelect>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-9 rounded-full px-3 text-xs text-muted-foreground whitespace-nowrap',
                      advancedOpen && 'bg-accent text-foreground'
                    )}
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                  >
                    <SlidersHorizontal />
                    高级设置
                    <ChevronDown
                      className={cn(
                        'size-3 transition-transform duration-200',
                        advancedOpen && 'rotate-180'
                      )}
                    />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {supportsStructuredInitialInput
                    ? '发送后会创建会话并提交首条消息'
                    : '请填写完整 JSON 后再发送'}
                </p>
              </div>
            }
            footer={
              <MessageComposerFooterActions className="pl-0">
                {canCancel ? (
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    取消
                  </Button>
                ) : null}
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={createMutation.isPending || !hasInitialMessageDraft}
                  className="h-9 min-w-24 rounded-full px-5 shadow-sm"
                >
                  {createMutation.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  发送
                </Button>
              </MessageComposerFooterActions>
            }
            className="border-border/40 bg-background/95 shadow-[0_28px_80px_-36px_hsl(var(--foreground)/0.18)]"
          >
            <div className="space-y-4 pb-1">
              {supportsStructuredInitialInput ? (
                <MessageComposerField
                  label="首条消息"
                  error={form.formState.errors.initialMessageText?.message}
                >
                  <MessageComposerInputArea hint="Enter 发送，Shift+Enter 换行">
                    <Textarea
                      aria-label="首条消息"
                      rows={9}
                      autoFocus
                      placeholder="输入首条消息..."
                      className="min-h-40 resize-none border-0 bg-transparent px-3 py-3 pb-8 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-44"
                      onKeyDown={handlePromptKeyDown}
                      {...form.register('initialMessageText')}
                    />
                  </MessageComposerInputArea>
                </MessageComposerField>
              ) : (
                <MessageComposerField
                  label="首条消息 JSON"
                  error={form.formState.errors.initialRawInput?.message}
                >
                  <MessageComposerInputArea hint="使用发送按钮提交，Enter 仅换行">
                    <Textarea
                      aria-label="首条消息 JSON"
                      rows={10}
                      autoFocus
                      placeholder={'{\n  "prompt": ""\n}'}
                      className="min-h-36 resize-none border-0 bg-transparent px-3 py-3 pb-8 font-mono text-sm shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-40"
                      onKeyDown={handlePromptKeyDown}
                      {...form.register('initialRawInput')}
                    />
                  </MessageComposerInputArea>
                </MessageComposerField>
              )}
            </div>
          </MessageComposerShell>
        </div>
      </div>

      {/* Inline collapsible advanced settings */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          advancedOpen
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="mx-auto max-w-4xl border-t border-border/30 px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">高级设置</p>
              <p className="text-xs text-muted-foreground">
                资源、输入参数和会话参数
              </p>
            </div>

            <div className="space-y-5">
              {additionalInputFields.length > 0 ? (
                <SetupSection title="输入参数">
                  <div className="grid gap-4">
                    {additionalInputFields.map((field) => (
                      <DynamicConfigFieldInput
                        key={field.name}
                        field={field}
                        namePrefix="initialInputConfig"
                        control={form.control}
                        discoveredOptions={runnerContext}
                      />
                    ))}
                  </div>
                </SetupSection>
              ) : null}

              {sessionConfigSchema.supported &&
              sessionConfigSchema.fields.length > 0 ? (
                <SetupSection title="会话参数 (Session Config)">
                  <div className="grid gap-4">
                    {sessionConfigSchema.fields.map((field) => (
                      <DynamicConfigFieldInput
                        key={field.name}
                        field={field}
                        namePrefix="runnerSessionConfig"
                        control={form.control}
                        discoveredOptions={runnerContext}
                      />
                    ))}
                  </div>
                </SetupSection>
              ) : null}

              {runtimeFields.length > 0 ? (
                <SetupSection title="运行参数 (Runtime Config)">
                  <div className="grid gap-4">
                    {runtimeFields.map((field) => (
                      <DynamicConfigFieldInput
                        key={field.name}
                        field={field}
                        namePrefix="initialRuntimeConfig"
                        control={form.control}
                        discoveredOptions={runnerContext}
                      />
                    ))}
                  </div>
                </SetupSection>
              ) : null}

              <SetupSection title="资源">
                <div className="grid gap-5 xl:grid-cols-2">
                  <ResourceSelectionSection
                    label="技能"
                    items={resources.skills}
                    value={selectedSkillIds}
                    onToggle={(resourceId) =>
                      toggleSelection('skillIds', resourceId)
                    }
                  />
                  <ResourceSelectionSection
                    label="规则"
                    items={resources.rules}
                    value={selectedRuleIds}
                    onToggle={(resourceId) =>
                      toggleSelection('ruleIds', resourceId)
                    }
                  />
                  <ResourceSelectionSection
                    label="MCP"
                    items={resources.mcps}
                    value={selectedMcpIds}
                    onToggle={(resourceId) =>
                      toggleSelection('mcpIds', resourceId)
                    }
                    getHint={(item) =>
                      typeof item.content === 'object' && item.content
                        ? item.content.command
                        : undefined
                    }
                  />
                </div>
              </SetupSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
