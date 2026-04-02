import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ResourceKind, ResourceRecord } from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch
} from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  isNotFoundApiError
} from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { getResource, saveResourceByKind } from '@/api/resources';
import { EditorToolbar } from '@/components/app/EditorToolbar';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { CodeEditor } from '@/components/JsonEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/query/query-keys';
import { resourceConfigMap } from '@/types/resources';
import {
  resourceEditConfigMap,
  resourceMarkdownFormSchema,
  resourceMcpFormSchema,
  toEnvObject,
  type ResourceFormValues,
  type ResourceMarkdownFormValues,
  type ResourceMcpFormValues,
  type ResourceMutationPayload
} from './resource-edit.utils';

type ResourceEditPageProps = {
  kind: ResourceKind;
};

type MarkdownPayload = Parameters<typeof saveResourceByKind.skills>[0];
type McpPayload = Parameters<typeof saveResourceByKind.mcps>[0];

function isMcpPayload(payload: ResourceMutationPayload): payload is McpPayload {
  return typeof payload.content !== 'string';
}

function isMarkdownPayload(
  payload: ResourceMutationPayload
): payload is MarkdownPayload {
  return typeof payload.content === 'string';
}

function saveResourcePayload(
  kind: ResourceKind,
  payload: ResourceMutationPayload,
  id?: string
) {
  if (kind === 'mcps') {
    if (!isMcpPayload(payload)) {
      throw new Error('Invalid MCP payload.');
    }

    return saveResourceByKind.mcps(payload, id);
  }

  if (!isMarkdownPayload(payload)) {
    throw new Error('Invalid markdown payload.');
  }

  return kind === 'skills'
    ? saveResourceByKind.skills(payload, id)
    : saveResourceByKind.rules(payload, id);
}

function toMarkdownFormValues(values: ResourceFormValues): ResourceMarkdownFormValues {
  return {
    name: values.name,
    description: values.description ?? '',
    contentText: values.contentText ?? ''
  };
}

function toMcpFormValues(values: ResourceFormValues): ResourceMcpFormValues {
  return {
    name: values.name,
    description: values.description ?? '',
    type: 'stdio',
    command: values.command ?? '',
    argsText: values.argsText ?? '',
    envEntries: values.envEntries ?? []
  };
}

type ResourcePageFrameProps = {
  title: string;
  loading: boolean;
  contentError: string | null;
  onBack: () => void;
  onSave: () => void;
  children: React.ReactNode;
};

function ResourcePageFrame({
  title,
  loading,
  contentError,
  onBack,
  onSave,
  children
}: ResourcePageFrameProps) {
  return (
    <div className="space-y-4">
      <EditorToolbar
        title={title}
        onBack={onBack}
        onSave={onSave}
        saveDisabled={loading}
      />

      {children}

      {contentError ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{contentError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function MarkdownResourceForm({
  title,
  initialValues,
  loading,
  contentError,
  onBack,
  onSave
}: {
  title: string;
  initialValues: ResourceMarkdownFormValues;
  loading: boolean;
  contentError: string | null;
  onBack: () => void;
  onSave: (values: ResourceMarkdownFormValues) => void;
}) {
  const form = useForm<ResourceMarkdownFormValues>({
    resolver: zodResolver(resourceMarkdownFormSchema),
    defaultValues: initialValues
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <ResourcePageFrame
      title={title}
      loading={loading}
      contentError={contentError}
      onBack={onBack}
      onSave={() => void form.handleSubmit(onSave)()}
    >
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <SurfaceCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField
              label="Name"
              htmlFor="resource-name"
              error={form.formState.errors.name?.message}
            >
              <Input id="resource-name" {...form.register('name')} />
            </FormField>

            <FormField
              label="Description"
              htmlFor="resource-description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="resource-description"
                rows={4}
                {...form.register('description')}
              />
            </FormField>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <Controller
            control={form.control}
            name="contentText"
            render={({ field }) => (
              <FormField
                label="Content"
                error={form.formState.errors.contentText?.message}
              >
                <CodeEditor
                  value={field.value}
                  onChange={field.onChange}
                  mode="markdown"
                />
              </FormField>
            )}
          />
        </SurfaceCard>
      </form>
    </ResourcePageFrame>
  );
}

function McpResourceForm({
  title,
  initialValues,
  loading,
  contentError,
  onBack,
  onSave
}: {
  title: string;
  initialValues: ResourceMcpFormValues;
  loading: boolean;
  contentError: string | null;
  onBack: () => void;
  onSave: (values: ResourceMcpFormValues) => void;
}) {
  const form = useForm<ResourceMcpFormValues>({
    resolver: zodResolver(resourceMcpFormSchema),
    defaultValues: initialValues
  });
  const envFieldArray = useFieldArray({
    control: form.control,
    name: 'envEntries'
  });
  const commandValue = useWatch({
    control: form.control,
    name: 'command'
  }) ?? '';
  const argsTextValue = useWatch({
    control: form.control,
    name: 'argsText'
  }) ?? '';
  const envEntriesValue = useWatch({
    control: form.control,
    name: 'envEntries'
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const mcpPreview = useMemo(() => {
    const preview = {
      type: 'stdio' as const,
      command: commandValue.trim(),
      args: argsTextValue
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      env: toEnvObject(envEntriesValue ?? [])
    };

    return JSON.stringify(
      preview.env
        ? preview
        : { type: preview.type, command: preview.command, args: preview.args },
      null,
      2
    );
  }, [argsTextValue, commandValue, envEntriesValue]);

  return (
    <ResourcePageFrame
      title={title}
      loading={loading}
      contentError={contentError}
      onBack={onBack}
      onSave={() => void form.handleSubmit(onSave)()}
    >
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <SurfaceCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField
              label="Name"
              htmlFor="resource-name"
              error={form.formState.errors.name?.message}
            >
              <Input id="resource-name" {...form.register('name')} />
            </FormField>

            <FormField
              label="Description"
              htmlFor="resource-description"
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="resource-description"
                rows={4}
                {...form.register('description')}
              />
            </FormField>
          </div>
        </SurfaceCard>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="space-y-4">
            <SurfaceCard>
              <div className="space-y-4">
                <FormField label="Type" htmlFor="resource-type">
                  <Input id="resource-type" value="stdio" disabled readOnly />
                </FormField>

                <FormField
                  label="Command"
                  htmlFor="resource-command"
                  error={form.formState.errors.command?.message}
                >
                  <Input id="resource-command" {...form.register('command')} />
                </FormField>
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <FormField
                label="Args"
                htmlFor="resource-args"
              >
                <Textarea
                  id="resource-args"
                  rows={6}
                  placeholder="--yes&#10;@modelcontextprotocol/server-filesystem"
                  {...form.register('argsText')}
                />
              </FormField>
            </SurfaceCard>

            <SurfaceCard>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Env</p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Add env"
                  title="Add env"
                  onClick={() => envFieldArray.append({ key: '', value: '' })}
                >
                  <Plus />
                </Button>
              </div>

              <div className="space-y-3">
                {envFieldArray.fields.length > 0 ? (
                  envFieldArray.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]"
                    >
                      <Input
                        placeholder="KEY"
                        {...form.register(`envEntries.${index}.key`)}
                      />
                      <Input
                        placeholder="VALUE"
                        {...form.register(`envEntries.${index}.value`)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => envFieldArray.remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">暂无环境变量。</p>
                )}
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard>
            <CodeEditor value={mcpPreview} onChange={() => undefined} readOnly />
          </SurfaceCard>
        </div>
      </form>
    </ResourcePageFrame>
  );
}

export function ResourceEditPage({ kind }: ResourceEditPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [contentError, setContentError] = useState<string | null>(null);

  const config = resourceConfigMap[kind];
  const isEditing = Boolean(id);

  const resourceQuery = useQuery({
    queryKey: id
      ? queryKeys.resources.detail(kind, id)
      : queryKeys.resources.details(),
    queryFn: () => getResource(kind, id!),
    enabled: isEditing
  });
  const resourceNotFound = isEditing && isNotFoundApiError(resourceQuery.error);

  useEffect(() => {
    if (resourceQuery.error && !resourceNotFound) {
      handleError(resourceQuery.error);
    }
  }, [handleError, resourceNotFound, resourceQuery.error]);

  const saveMutation = useMutation<ResourceRecord, Error, ResourceMutationPayload>({
    mutationFn: (payload) => saveResourcePayload(kind, payload, id),
    onSuccess: async (resource) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.resources.lists()
        }),
        queryClient.setQueryData(
          queryKeys.resources.detail(kind, resource.id),
          resource
        )
      ]);
      void navigate(config.path);
    }
  });

  const title = `${isEditing ? '编辑' : '新建'} ${config.singularLabel}`;
  const initialValues = useMemo<ResourceFormValues>(() => {
    if (resourceQuery.data) {
      return resourceEditConfigMap[kind].toFormValues(resourceQuery.data);
    }

    return resourceEditConfigMap[kind].createInitialValues();
  }, [kind, resourceQuery.data]);

  const loading =
    (isEditing && (resourceQuery.isPending || resourceQuery.isFetching)) ||
    saveMutation.isPending;

  if (resourceNotFound) {
    return (
      <EmptyState
        title={`未找到 ${config.singularLabel}`}
        description="当前资源不存在或已被删除。"
        action={
          <Button variant="outline" onClick={() => void navigate(config.path)}>
            <ArrowLeft data-icon="inline-start" />
            返回列表
          </Button>
        }
      />
    );
  }

  const handleSaveMarkdown = async (values: ResourceMarkdownFormValues) => {
    setContentError(null);

    try {
      const { data, error } = resourceEditConfigMap[kind].buildPayload(values);
      if (!data) {
        setContentError(error);
        return;
      }

      await saveMutation.mutateAsync(data);
    } catch (error) {
      handleError(error);
    }
  };

  const handleSaveMcp = async (values: ResourceMcpFormValues) => {
    setContentError(null);

    try {
      const { data, error } = resourceEditConfigMap.mcps.buildPayload(values);
      if (!data) {
        setContentError(error);
        return;
      }

      await saveMutation.mutateAsync(data);
    } catch (error) {
      handleError(error);
    }
  };

  if (kind === 'mcps') {
    return (
      <McpResourceForm
        title={title}
        initialValues={toMcpFormValues(initialValues)}
        loading={loading}
        contentError={contentError}
        onBack={() => void navigate(config.path)}
        onSave={(values) => {
          void handleSaveMcp(values);
        }}
      />
    );
  }

  return (
    <MarkdownResourceForm
      title={title}
      initialValues={toMarkdownFormValues(initialValues)}
      loading={loading}
      contentError={contentError}
      onBack={() => void navigate(config.path)}
      onSave={(values) => {
        void handleSaveMarkdown(values);
      }}
    />
  );
}
