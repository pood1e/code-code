import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  type UseFormRegister,
  useFieldArray,
  useForm,
  useWatch
} from 'react-hook-form';

import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { CodeEditor } from '@/components/JsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  resourceMcpFormSchema,
  toEnvObject,
  type ResourceMcpFormValues
} from './resource-edit.form';
import {
  ResourceBasicsSection,
  ResourceEditorFrame
} from './resource-editor-frame';

type McpResourceFormProps = {
  contentError: string | null;
  initialValues: ResourceMcpFormValues;
  loading: boolean;
  onBack: () => void;
  onSave: (values: ResourceMcpFormValues) => void;
  title: string;
};

type McpCommandSectionProps = {
  commandError?: string;
  register: UseFormRegister<ResourceMcpFormValues>;
};

type McpEnvSectionProps = {
  fields: Array<{ id: string }>;
  onAppend: () => void;
  onRemove: (index: number) => void;
  register: UseFormRegister<ResourceMcpFormValues>;
};

export function McpResourceForm({
  contentError,
  initialValues,
  loading,
  onBack,
  onSave,
  title
}: McpResourceFormProps) {
  const form = useForm<ResourceMcpFormValues>({
    resolver: zodResolver(resourceMcpFormSchema),
    defaultValues: initialValues
  });
  const envFieldArray = useFieldArray({
    control: form.control,
    name: 'envEntries'
  });
  const commandValue =
    useWatch({
      control: form.control,
      name: 'command'
    }) ?? '';
  const argsTextValue =
    useWatch({
      control: form.control,
      name: 'argsText'
    }) ?? '';
  const envEntriesValue = useWatch({
    control: form.control,
    name: 'envEntries'
  });

  const mcpPreview = useMemo(
    () =>
      stringifyMcpPreview({
        argsText: argsTextValue,
        command: commandValue,
        envEntries: envEntriesValue ?? []
      }),
    [argsTextValue, commandValue, envEntriesValue]
  );

  return (
    <ResourceEditorFrame
      contentError={contentError}
      loading={loading}
      onBack={onBack}
      onSave={() => void form.handleSubmit(onSave)()}
      title={title}
    >
      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <ResourceBasicsSection
          descriptionError={form.formState.errors.description?.message}
          descriptionField={form.register('description')}
          nameField={form.register('name')}
          nameError={form.formState.errors.name?.message}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="space-y-4">
            <McpCommandSection
              commandError={form.formState.errors.command?.message}
              register={form.register}
            />

            <SurfaceCard>
              <FormField label="Args" htmlFor="resource-args">
                <Textarea
                  id="resource-args"
                  placeholder="--yes&#10;@modelcontextprotocol/server-filesystem"
                  rows={6}
                  {...form.register('argsText')}
                />
              </FormField>
            </SurfaceCard>

            <McpEnvSection
              fields={envFieldArray.fields}
              onAppend={() => envFieldArray.append({ key: '', value: '' })}
              onRemove={envFieldArray.remove}
              register={form.register}
            />
          </div>

          <SurfaceCard>
            <CodeEditor readOnly value={mcpPreview} onChange={() => undefined} />
          </SurfaceCard>
        </div>
      </form>
    </ResourceEditorFrame>
  );
}

function McpCommandSection({
  commandError,
  register
}: McpCommandSectionProps) {
  return (
    <SurfaceCard>
      <div className="space-y-4">
        <FormField label="Type" htmlFor="resource-type">
          <Input id="resource-type" value="stdio" disabled readOnly />
        </FormField>

        <FormField
          label="Command"
          htmlFor="resource-command"
          error={commandError}
        >
          <Input id="resource-command" {...register('command')} />
        </FormField>
      </div>
    </SurfaceCard>
  );
}

function McpEnvSection({
  fields,
  onAppend,
  onRemove,
  register
}: McpEnvSectionProps) {
  return (
    <SurfaceCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Env</p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="添加环境变量"
          title="添加环境变量"
          onClick={onAppend}
        >
          <Plus />
        </Button>
      </div>

      <div className="space-y-3">
        {fields.length > 0 ? (
          fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]"
            >
              <Input
                placeholder="KEY"
                {...register(`envEntries.${index}.key`)}
              />
              <Input
                placeholder="VALUE"
                {...register(`envEntries.${index}.value`)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`移除环境变量 ${index + 1}`}
                title={`移除环境变量 ${index + 1}`}
                onClick={() => onRemove(index)}
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
  );
}

function stringifyMcpPreview({
  argsText,
  command,
  envEntries
}: {
  argsText: string;
  command: string;
  envEntries: ResourceMcpFormValues['envEntries'];
}) {
  const preview = {
    type: 'stdio' as const,
    command: command.trim(),
    args: argsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    env: toEnvObject(envEntries)
  };

  return JSON.stringify(
    preview.env
      ? preview
      : { type: preview.type, command: preview.command, args: preview.args },
    null,
    2
  );
}
