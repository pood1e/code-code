import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunnerTypeResponse } from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  isNotFoundApiError,
  useErrorMessage
} from '@/api/client';
import {
  createAgentRunner,
  getAgentRunner,
  listAgentRunnerTypes,
  updateAgentRunner
} from '@/api/agent-runners';
import { EditorToolbar } from '@/components/app/EditorToolbar';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { JsonEditor } from '@/components/JsonEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/query/query-keys';
import { agentRunnerConfig } from '@/types/agent-runners';
import {
  agentRunnerEditorFormSchema,
  buildAgentRunnerInitialValues,
  buildCreateAgentRunnerInput,
  buildRunnerConfigInitialValues,
  buildUpdateAgentRunnerInput,
  getRunnerConfigDefaultSummary,
  getRunnerConfigFieldValue,
  normalizeRunnerConfigValues,
  parseRawRunnerConfigText,
  parseRunnerConfigSchema,
  stringifyRunnerConfig,
  type AgentRunnerEditorFormValues,
  type RunnerConfigField
} from './agent-runner.utils';

const selectClassName =
  'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50';

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-40 animate-pulse rounded-xl bg-muted/80" />
      <div className="h-28 animate-pulse rounded-[calc(var(--radius)*1.2)] bg-muted/70" />
      <div className="h-72 animate-pulse rounded-[calc(var(--radius)*1.2)] bg-muted/60" />
    </div>
  );
}

function RunnerConfigFieldInput({
  field,
  control
}: {
  field: RunnerConfigField;
  control: ReturnType<typeof useForm<AgentRunnerEditorFormValues>>['control'];
}) {
  return (
    <Controller
      control={control}
      name={`runnerConfig.${field.name}`}
      render={({ field: controllerField, fieldState }) => {
        if (field.kind === 'boolean') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(controllerField.value)}
                  onChange={(event) => controllerField.onChange(event.target.checked)}
                  className="size-4 rounded border border-input text-primary accent-[var(--primary)]"
                />
                <span className="text-sm text-foreground">
                  {field.required ? '启用此配置' : '按需启用此配置'}
                </span>
              </label>
            </FormField>
          );
        }

        if (field.kind === 'enum') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <select
                value={getRunnerConfigFieldValue(field, controllerField.value)}
                onChange={(event) => controllerField.onChange(event.target.value)}
                className={selectClassName}
              >
                {!field.required ? <option value="">未设置</option> : null}
                {field.enumOptions?.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          );
        }

        return (
          <FormField
            label={field.label}
            description={field.description}
            error={fieldState.error?.message}
          >
            <Input
              type={
                field.kind === 'url'
                  ? 'url'
                  : field.kind === 'number' || field.kind === 'integer'
                    ? 'number'
                    : 'text'
              }
              inputMode={
                field.kind === 'number' || field.kind === 'integer'
                  ? 'decimal'
                  : undefined
              }
              step={field.kind === 'integer' ? 1 : undefined}
              value={getRunnerConfigFieldValue(field, controllerField.value)}
              onChange={(event) => controllerField.onChange(event.target.value)}
            />
          </FormField>
        );
      }}
    />
  );
}

function AgentRunnerEditorContent({
  runnerTypes,
  runnerId,
  initialValues,
  onBack
}: {
  runnerTypes: RunnerTypeResponse[];
  runnerId?: string;
  initialValues: AgentRunnerEditorFormValues;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rawRunnerConfigText, setRawRunnerConfigText] = useState(() =>
    stringifyRunnerConfig(initialValues.runnerConfig)
  );
  const [rawRunnerConfigError, setRawRunnerConfigError] = useState<string | null>(
    null
  );
  const isEditing = Boolean(runnerId);

  const form = useForm<AgentRunnerEditorFormValues>({
    resolver: zodResolver(agentRunnerEditorFormSchema),
    defaultValues: initialValues
  });

  useEffect(() => {
    form.reset(initialValues);
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
    mutationFn: (values: AgentRunnerEditorFormValues) => {
      if (parsedSchema.supported) {
        const runnerConfig = normalizeRunnerConfigValues(
          parsedSchema.fields,
          values.runnerConfig ?? {}
        );
        const validationResult = parsedSchema.validationSchema.safeParse(
          runnerConfig
        );

        if (!validationResult.success) {
          for (const issue of validationResult.error.issues) {
            const fieldName = issue.path[0];
            if (typeof fieldName === 'string') {
              form.setError(`runnerConfig.${fieldName}`, {
                message: issue.message
              });
            }
          }
          throw new Error('表单校验失败');
        }

        return isEditing && runnerId
          ? updateAgentRunner(
              runnerId,
              buildUpdateAgentRunnerInput(values, validationResult.data)
            )
          : createAgentRunner(
              buildCreateAgentRunnerInput(values, validationResult.data)
            );
      }

      const rawRunnerConfigResult = parseRawRunnerConfigText(rawRunnerConfigText);
      if (!rawRunnerConfigResult.data) {
        setRawRunnerConfigError(
          rawRunnerConfigResult.error ?? 'Runner Config 校验失败'
        );
        throw new Error('原始配置校验失败');
      }

      return isEditing && runnerId
        ? updateAgentRunner(
            runnerId,
            buildUpdateAgentRunnerInput(values, rawRunnerConfigResult.data)
          )
        : createAgentRunner(
            buildCreateAgentRunnerInput(values, rawRunnerConfigResult.data)
          );
    },
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

  const title = `${isEditing ? '编辑' : '新建'} ${agentRunnerConfig.singularLabel}`;
  const saveDisabled = saveMutation.isPending || !selectedRunnerType;

  const handleTypeChange = (nextTypeId: string) => {
    const nextRunnerType = runnerTypes.find(
      (runnerType) => runnerType.id === nextTypeId
    );
    const nextSchema = parseRunnerConfigSchema(nextRunnerType?.runnerConfigSchema);
    const currentValues = form.getValues();

    form.reset({
      ...currentValues,
      type: nextTypeId,
      runnerConfig:
        nextSchema.supported && nextRunnerType
          ? buildRunnerConfigInitialValues(nextSchema.fields)
          : {}
    });
    setRawRunnerConfigText(
      nextSchema.supported
        ? stringifyRunnerConfig(buildRunnerConfigInitialValues(nextSchema.fields))
        : stringifyRunnerConfig()
    );
    setRawRunnerConfigError(null);
    setSubmitError(null);
  };

  const handleSave = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setRawRunnerConfigError(null);
    form.clearErrors();

    try {
      await saveMutation.mutateAsync(values);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === '表单校验失败' ||
          error.message === '原始配置校验失败')
      ) {
        return;
      }

      setSubmitError(error instanceof Error ? error.message : '保存失败');
      handleError(error);
    }
  });

  return (
    <div className="space-y-4">
      <EditorToolbar
        title={title}
        onBack={onBack}
        onSave={() => void handleSave()}
        saveDisabled={saveDisabled}
      />

      {submitError ? (
        <Alert variant="destructive" className="rounded-[calc(var(--radius)*0.95)]">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <SurfaceCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField
              label="Name"
              htmlFor="agent-runner-name"
              error={form.formState.errors.name?.message}
            >
              <Input id="agent-runner-name" {...form.register('name')} />
            </FormField>

            <FormField
              label="Type"
              htmlFor="agent-runner-type"
              description={getRunnerConfigDefaultSummary(selectedRunnerType)}
              error={form.formState.errors.type?.message}
            >
              {isEditing ? (
                <Input
                  id="agent-runner-type"
                  value={selectedRunnerType?.name ?? form.getValues('type')}
                  disabled
                  readOnly
                />
              ) : (
                <select
                  id="agent-runner-type"
                  value={selectedTypeId ?? ''}
                  onChange={(event) => handleTypeChange(event.target.value)}
                  className={selectClassName}
                >
                  {runnerTypes.map((runnerType) => (
                    <option key={runnerType.id} value={runnerType.id}>
                      {runnerType.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="mt-4">
            <FormField
              label="Description"
              htmlFor="agent-runner-description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="agent-runner-description"
                rows={4}
                {...form.register('description')}
              />
            </FormField>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="border-b border-border/70 pb-4">
            <p className="text-sm font-medium text-foreground">Runner Config</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              按所选 RunnerType 的 L1 配置 Schema 填写长期稳定配置。
            </p>
          </div>

          {parsedSchema.supported ? (
            parsedSchema.fields.length > 0 ? (
              <div className="grid gap-4 pt-4 lg:grid-cols-2">
                {parsedSchema.fields.map((field) => (
                  <RunnerConfigFieldInput
                    key={field.name}
                    field={field}
                    control={form.control}
                  />
                ))}
              </div>
            ) : (
              <div className="pt-4">
                <Alert className="rounded-[calc(var(--radius)*0.95)] border-border/70">
                  <AlertTitle>当前类型没有可编辑字段</AlertTitle>
                  <AlertDescription>
                    该 RunnerType 的 L1 配置为空，保存时将提交空对象。
                  </AlertDescription>
                </Alert>
              </div>
            )
          ) : (
            <div className="space-y-4 pt-4">
              <Alert className="rounded-[calc(var(--radius)*0.95)] border-border/70">
                <AlertTitle>当前 RunnerType 使用原始 JSON 编辑</AlertTitle>
                <AlertDescription>{parsedSchema.reason}</AlertDescription>
              </Alert>

              <FormField
                label="Runner Config JSON"
                description="当前 schema 无法被工作台结构化渲染，请直接编辑原始 JSON 对象。"
                error={rawRunnerConfigError ?? undefined}
              >
                <JsonEditor
                  value={rawRunnerConfigText}
                  onChange={(value) => {
                    setRawRunnerConfigText(value);
                    if (rawRunnerConfigError) {
                      setRawRunnerConfigError(null);
                    }
                  }}
                />
              </FormField>
            </div>
          )}
        </SurfaceCard>
      </form>
    </div>
  );
}

export function AgentRunnerEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const isEditing = Boolean(id);

  const runnerTypesQuery = useQuery({
    queryKey: queryKeys.agentRunnerTypes.all,
    queryFn: listAgentRunnerTypes
  });
  const agentRunnerQuery = useQuery({
    queryKey: id
      ? queryKeys.agentRunners.detail(id)
      : queryKeys.agentRunners.all,
    queryFn: () => getAgentRunner(id!),
    enabled: isEditing
  });
  const agentRunnerNotFound = isEditing && isNotFoundApiError(agentRunnerQuery.error);

  useEffect(() => {
    if (runnerTypesQuery.error) {
      handleError(runnerTypesQuery.error);
    }
  }, [handleError, runnerTypesQuery.error]);

  useEffect(() => {
    if (agentRunnerQuery.error && !agentRunnerNotFound) {
      handleError(agentRunnerQuery.error);
    }
  }, [agentRunnerNotFound, agentRunnerQuery.error, handleError]);

  if (agentRunnerNotFound) {
    return (
      <EmptyState
        title={`未找到 ${agentRunnerConfig.singularLabel}`}
        description="当前 AgentRunner 不存在或已被删除。"
        action={
          <Button
            variant="outline"
            onClick={() => void navigate(agentRunnerConfig.path)}
          >
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  if (runnerTypesQuery.isPending || (isEditing && agentRunnerQuery.isPending)) {
    return <LoadingState />;
  }

  if (runnerTypesQuery.error || !runnerTypesQuery.data) {
    return (
      <EmptyState
        title="无法加载 Runner Types"
        description="当前无法获取 RunnerType 注册信息，请刷新后重试。"
        action={
          <Button variant="outline" onClick={() => void runnerTypesQuery.refetch()}>
            <RefreshCw data-icon="inline-start" />
            重试
          </Button>
        }
      />
    );
  }

  if (runnerTypesQuery.data.length === 0) {
    return (
      <EmptyState
        title="暂无 Runner Type"
        description="后端当前没有注册任何 RunnerType，暂时无法创建 AgentRunner。"
        action={
          <Button
            variant="outline"
            onClick={() => void navigate(agentRunnerConfig.path)}
          >
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  if (isEditing && (agentRunnerQuery.error || !agentRunnerQuery.data)) {
    return <LoadingState />;
  }

  return (
    <AgentRunnerEditorContent
      key={`${id ?? 'new'}:${agentRunnerQuery.data?.updatedAt ?? 'draft'}`}
      runnerTypes={runnerTypesQuery.data}
      runnerId={id}
      initialValues={buildAgentRunnerInitialValues(
        runnerTypesQuery.data,
        agentRunnerQuery.data
      )}
      onBack={() => {
        void navigate(agentRunnerConfig.path);
      }}
    />
  );
}
