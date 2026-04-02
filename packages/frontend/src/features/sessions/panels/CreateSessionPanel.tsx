import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseSessionInputText } from '@/features/chat/runtime/assistant-ui/input-payload';
import {
  buildAdditionalInputInitialValues,
  buildStructuredMessagePayload,
  getAdditionalInputFields,
  getPrimaryInputField
} from '@/features/chat/runtime/assistant-ui/input-schema';
import {
  buildRunnerConfigInitialValues,
  normalizeRunnerConfigValues,
  parseRunnerConfigSchema
} from '@/lib/runner-config-schema';
import {
  buildCreateSessionFormValues,
  buildCreateSessionPayload,
  createSessionFormSchema,
  type CreateSessionFormValues
} from '@/pages/projects/project-sessions.utils';
import { createSession } from '@/api/sessions';
import { getProfile } from '@/api/profiles';
import { probeAgentRunnerContext } from '@/api/agent-runners';
import { toApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { DynamicConfigFieldInput } from '../components/DynamicConfigFieldInput';
import { ResourceSelectionSection } from '../components/ResourceSelectionSection';
import { SetupSection } from '../components/SetupSection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
import { LoaderCircle, SlidersHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import type { AgentRunnerSummary, Profile, ResourceByKind, RunnerTypeResponse, SessionDetail } from '@agent-workbench/shared';

const selectClassName =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50';

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
  const queryClient = useQueryClient();
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
    () => parseRunnerConfigSchema(selectedRunnerType?.runnerSessionConfigSchema),
    [selectedRunnerType]
  );
  const inputConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.inputSchema),
    [selectedRunnerType]
  );
  const structuredInputSchema = inputConfigSchema.supported ? inputConfigSchema : undefined;
  
  const runtimeConfigSchema = useMemo(
    () => parseRunnerConfigSchema(selectedRunnerType?.runtimeConfigSchema),
    [selectedRunnerType]
  );
  const structuredRuntimeSchema = runtimeConfigSchema.supported ? runtimeConfigSchema : undefined;
  const runtimeFields = useMemo(() => structuredRuntimeSchema?.fields ?? [], [structuredRuntimeSchema]);

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
    queryKey: selectedRunnerId ? queryKeys.agentRunners.context(selectedRunnerId) : ['agent-runners', 'context', 'empty'],
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
      form.setValue('initialRuntimeConfig', buildAdditionalInputInitialValues(runtimeFields));
      form.setValue('initialMessageText', '');
      form.setValue('initialRawInput', '');
      return;
    }

    form.setValue(
      'initialInputConfig',
      buildAdditionalInputInitialValues(additionalInputFields)
    );
    form.setValue('initialRuntimeConfig', buildAdditionalInputInitialValues(runtimeFields));
    form.setValue('initialMessageText', '');
    form.setValue('initialRawInput', '');
  }, [additionalInputFields, runtimeFields, form, selectedRunnerType?.id, structuredInputSchema]);

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

  const createMutation = useMutation({
    mutationFn: async (values: CreateSessionFormValues) => {
      let runnerSessionConfig = values.runnerSessionConfig;
      if (sessionConfigSchema.supported) {
        const normalized = normalizeRunnerConfigValues(
          sessionConfigSchema.fields,
          values.runnerSessionConfig
        );
        const validationResult = sessionConfigSchema.validationSchema.safeParse(
          normalized
        );
        if (!validationResult.success) {
          for (const issue of validationResult.error.issues) {
            const fieldName = issue.path[0];
            if (typeof fieldName === 'string') {
              form.setError(`runnerSessionConfig.${fieldName}` as any, {
                message: issue.message
              });
            }
          }
          throw new Error('Session 配置校验失败');
        }

        runnerSessionConfig = validationResult.data;
      }

      const initialMessageTextValue = values.initialMessageText?.trim() ?? '';
      const initialRawInputValue = values.initialRawInput?.trim() ?? '';
      const initialMessage = supportsStructuredInitialInput
        ? initialMessageTextValue.length > 0
          ? buildStructuredMessagePayload({
              schema: structuredInputSchema!,
              runtimeSchema: structuredRuntimeSchema ?? { supported: false as const, reason: '不支持' },
              primaryField: primaryInputField!,
              composerText: initialMessageTextValue,
              additionalValues: values.initialInputConfig,
              runtimeValues: values.initialRuntimeConfig
            })
          : undefined
        : initialRawInputValue.length > 0
          ? (() => {
              const parsed = parseSessionInputText(initialRawInputValue);
              if (!parsed.data) {
                throw new Error(parsed.error ?? '首条消息输入校验失败');
              }
              // Add runtime config manually since parser only gives input
              let runtimeConfig: Record<string, unknown> | undefined = undefined;
              if (structuredRuntimeSchema?.supported && structuredRuntimeSchema.fields.length > 0) {
                 const normalized = normalizeRunnerConfigValues(structuredRuntimeSchema.fields, values.initialRuntimeConfig);
                 const validRuntime = structuredRuntimeSchema.validationSchema.safeParse(normalized);
                 if (!validRuntime.success) throw new Error('首条消息运行时参数校验失败');
                 runtimeConfig = validRuntime.data;
              }
              return { input: parsed.data.input, runtimeConfig };
            })()
          : undefined;

      return createSession(
        buildCreateSessionPayload(projectId, {
          ...values,
          runnerSessionConfig
        }, profileDetailQuery.data, initialMessage)
      );
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.list(projectId)
      });
      queryClient.setQueryData(queryKeys.sessions.detail(session.id), session);
      onCreated(session);
    }
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
          error.message === '首条消息输入校验失败')
      ) {
        return;
      }
      const apiError = toApiRequestError(error);
      setSubmitError(apiError.message);
      handleError(error);
    }
  });

  return (
    <div className="flex min-h-[36rem] flex-col xl:min-h-[calc(100vh-14rem)]">
      <div className="flex flex-1 flex-col px-2 py-2 sm:px-4 sm:py-4">
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>创建失败</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pt-10 sm:pt-14">
          <div className="rounded-3xl border border-border/40 bg-background/95 p-5 shadow-[0_28px_80px_-36px_hsl(var(--foreground)/0.18)] sm:p-6">
            {supportsStructuredInitialInput ? (
              <FormField label="" error={form.formState.errors.initialMessageText?.message}>
                <Textarea
                  rows={9}
                  placeholder="发一条消息开始新会话"
                  className="min-h-40 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-44"
                  {...form.register('initialMessageText')}
                />
              </FormField>
            ) : (
              <FormField
                label=""
                error={form.formState.errors.initialRawInput?.message}
                description="当前 RunnerType 的 input schema 不适合文本输入，请直接填写原始 JSON。"
              >
                <Textarea
                  rows={10}
                  placeholder='{\n  "prompt": ""\n}'
                  className="min-h-36 resize-none border-0 bg-transparent px-0 py-0 font-mono text-sm shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-0 sm:min-h-40"
                  {...form.register('initialRawInput')}
                />
              </FormField>
            )}

            <div className="mt-3 grid gap-3 border-t border-border/40 pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
                <select
                  className={`${selectClassName} h-9 w-auto min-w-[8.5rem] rounded-full bg-background/80 px-3 py-1.5 text-xs whitespace-nowrap`}
                  value={selectedRunnerId}
                  onChange={(event) => form.setValue('runnerId', event.target.value)}
                >
                  {runners.map((runner) => (
                    <option key={runner.id} value={runner.id}>
                      {runner.name}
                    </option>
                  ))}
                </select>

                <select
                  className={`${selectClassName} h-9 w-auto min-w-[8rem] rounded-full bg-background/80 px-3 py-1.5 text-xs whitespace-nowrap`}
                  value={selectedProfileId ?? ''}
                  onChange={(event) => form.setValue('profileId', event.target.value)}
                >
                  <option value="">Profile</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-3 text-xs text-muted-foreground whitespace-nowrap"
                  onClick={() => setAdvancedOpen(true)}
                >
                  <SlidersHorizontal />
                  高级设置
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {canCancel ? (
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    取消
                  </Button>
                ) : null}
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={createMutation.isPending || !hasInitialMessageDraft}
                  className="h-10 min-w-24 rounded-full px-5 shadow-sm"
                >
                  {createMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b border-border/40 px-5 py-4 text-left">
            <SheetTitle>高级设置</SheetTitle>
            <SheetDescription>资源、输入参数和会话参数。</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5">
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

            {sessionConfigSchema.supported && sessionConfigSchema.fields.length > 0 ? (
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
                  onToggle={(resourceId) => toggleSelection('skillIds', resourceId)}
                />
                <ResourceSelectionSection
                  label="规则"
                  items={resources.rules}
                  value={selectedRuleIds}
                  onToggle={(resourceId) => toggleSelection('ruleIds', resourceId)}
                />
                <ResourceSelectionSection
                  label="MCP"
                  items={resources.mcps}
                  value={selectedMcpIds}
                  onToggle={(resourceId) => toggleSelection('mcpIds', resourceId)}
                  getHint={(item) =>
                    typeof item.content === 'object' && item.content
                      ? item.content.command
                      : undefined
                  }
                />
              </div>
            </SetupSection>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
