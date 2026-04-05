import { Plus, Trash2 } from 'lucide-react';
import type { Control, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { RunnerTypeResponse } from '@agent-workbench/shared';

import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { JsonEditor } from '@/components/JsonEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

import {
  getRunnerConfigDefaultSummary,
  getRunnerConfigFieldValue,
  toStringMapEntries,
  toStringMapObject,
  type ParsedRunnerConfigSchema,
  shouldRenderEmptyEnumOption,
  type AgentRunnerEditorFormValues,
  type RunnerConfigField
} from './agent-runner.form';

export function AgentRunnerBasicsSection({
  descriptionError,
  isEditing,
  nameError,
  onTypeChange,
  register,
  runnerTypes,
  selectedRunnerType,
  selectedTypeId,
  typeError
}: {
  descriptionError?: string;
  isEditing: boolean;
  nameError?: string;
  onTypeChange: (nextTypeId: string) => void;
  register: UseFormRegister<AgentRunnerEditorFormValues>;
  runnerTypes: RunnerTypeResponse[];
  selectedRunnerType?: RunnerTypeResponse;
  selectedTypeId: string;
  typeError?: string;
}) {
  return (
    <SurfaceCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField label="Name" htmlFor="agent-runner-name" error={nameError}>
          <Input id="agent-runner-name" {...register('name')} />
        </FormField>

        <FormField
          label="Type"
          htmlFor="agent-runner-type"
          description={getRunnerConfigDefaultSummary(selectedRunnerType)}
          error={typeError}
        >
          {isEditing ? (
            <Input
              id="agent-runner-type"
              value={selectedRunnerType?.name ?? selectedTypeId}
              disabled
              readOnly
            />
          ) : (
            <CompactNativeSelect
              id="agent-runner-type"
              className="w-full rounded-xl bg-background"
              value={selectedTypeId}
              onChange={(event) => onTypeChange(event.target.value)}
            >
              {runnerTypes.map((runnerType) => (
                <option key={runnerType.id} value={runnerType.id}>
                  {runnerType.name}
                </option>
              ))}
            </CompactNativeSelect>
          )}
        </FormField>
      </div>

      <div className="mt-4">
        <FormField
          label="Description"
          htmlFor="agent-runner-description"
          error={descriptionError}
        >
          <Textarea
            id="agent-runner-description"
            rows={4}
            {...register('description')}
          />
        </FormField>
      </div>
    </SurfaceCard>
  );
}

export function AgentRunnerConfigSection({
  control,
  onRawRunnerConfigChange,
  parsedSchema,
  rawRunnerConfigError,
  rawRunnerConfigText
}: {
  control: Control<AgentRunnerEditorFormValues>;
  onRawRunnerConfigChange: (nextValue: string) => void;
  parsedSchema: ParsedRunnerConfigSchema;
  rawRunnerConfigError: string | null;
  rawRunnerConfigText: string;
}) {
  return (
    <SurfaceCard>
      <div className="border-b border-border/40 pb-4">
        <p className="text-sm font-medium text-foreground">Runner Config</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          按所选 RunnerType 的 L1 配置 Schema 填写长期稳定配置。
        </p>
      </div>

      <RunnerConfigEditorBody
        control={control}
        onRawRunnerConfigChange={onRawRunnerConfigChange}
        parsedSchema={parsedSchema}
        rawRunnerConfigError={rawRunnerConfigError}
        rawRunnerConfigText={rawRunnerConfigText}
      />
    </SurfaceCard>
  );
}

function RunnerConfigEditorBody({
  control,
  onRawRunnerConfigChange,
  parsedSchema,
  rawRunnerConfigError,
  rawRunnerConfigText
}: {
  control: Control<AgentRunnerEditorFormValues>;
  onRawRunnerConfigChange: (nextValue: string) => void;
  parsedSchema: ParsedRunnerConfigSchema;
  rawRunnerConfigError: string | null;
  rawRunnerConfigText: string;
}) {
  if (!parsedSchema.supported) {
    return (
      <div className="space-y-4 pt-4">
        <Alert className="rounded-xl border-border/40">
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
            onChange={onRawRunnerConfigChange}
          />
        </FormField>
      </div>
    );
  }

  if (parsedSchema.fields.length === 0) {
    return (
      <div className="pt-4">
        <Alert className="rounded-xl border-border/40">
          <AlertTitle>当前类型没有可编辑字段</AlertTitle>
          <AlertDescription>
            该 RunnerType 的 L1 配置为空，保存时将提交空对象。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-2">
      {parsedSchema.fields.map((field) => (
        <RunnerConfigFieldInput
          key={field.name}
          control={control}
          field={field}
        />
      ))}
    </div>
  );
}

function RunnerConfigFieldInput({
  control,
  field
}: {
  control: Control<AgentRunnerEditorFormValues>;
  field: RunnerConfigField;
}) {
  const fieldId = `agent-runner-config-${field.name}`;

  return (
    <Controller
      control={control}
      name={`runnerConfig.${field.name}`}
      render={({ field: controllerField, fieldState }) => (
        <RunnerConfigFieldControl
          controllerValue={controllerField.value}
          error={fieldState.error?.message}
          field={field}
          fieldId={fieldId}
          onChange={controllerField.onChange}
        />
      )}
    />
  );
}

function RunnerConfigFieldControl({
  controllerValue,
  error,
  field,
  fieldId,
  onChange
}: {
  controllerValue: unknown;
  error?: string;
  field: RunnerConfigField;
  fieldId: string;
  onChange: (nextValue: unknown) => void;
}) {
  if (field.kind === 'string_map') {
    const entries = toStringMapEntries(controllerValue);

    const updateEntry = (
      index: number,
      key: 'key' | 'value',
      value: string
    ) => {
      const nextEntries =
        entries.length > 0 ? [...entries] : [{ key: '', value: '' }];
      nextEntries[index] = {
        ...nextEntries[index],
        [key]: value
      };
      onChange(toStringMapObject(nextEntries));
    };

    const removeEntry = (index: number) => {
      onChange(toStringMapObject(entries.filter((_, entryIndex) => entryIndex !== index)));
    };

    const appendEntry = () => {
      onChange(toStringMapObject([...entries, { key: '', value: '' }]));
    };

    return (
      <FormField
        label={field.label}
        htmlFor={fieldId}
        description={field.description}
        error={error}
      >
        <div className="space-y-3 rounded-xl border border-border/40 bg-background/80 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              以 KEY / VALUE 形式配置
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`添加${field.label}`}
              onClick={appendEntry}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {entries.length > 0 ? (
            entries.map((entry, index) => (
              <div
                key={`${field.name}-${index}`}
                className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_auto]"
              >
                <Input
                  placeholder="KEY"
                  value={entry.key}
                  onChange={(event) =>
                    updateEntry(index, 'key', event.target.value)
                  }
                />
                <Input
                  placeholder="VALUE"
                  value={entry.value}
                  onChange={(event) =>
                    updateEntry(index, 'value', event.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={`移除${field.label} ${index + 1}`}
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">暂无配置项。</p>
          )}
        </div>
      </FormField>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <FormField
        label={field.label}
        htmlFor={fieldId}
        description={field.description}
        error={error}
      >
        <label className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/80 px-3 py-3">
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(controllerValue)}
            onChange={(event) => onChange(event.target.checked)}
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
        htmlFor={fieldId}
        description={field.description}
        error={error}
      >
        <CompactNativeSelect
          id={fieldId}
          className="w-full rounded-xl bg-background"
          value={getRunnerConfigFieldValue(field, controllerValue)}
          onChange={(event) => onChange(event.target.value)}
        >
          {shouldRenderEmptyEnumOption(field) ? (
            <option value="">未设置</option>
          ) : null}
          {field.enumOptions?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </CompactNativeSelect>
      </FormField>
    );
  }

  return (
    <FormField
      label={field.label}
      htmlFor={fieldId}
      description={field.description}
      error={error}
    >
      <Input
        id={fieldId}
        type={getRunnerConfigInputType(field.kind)}
        inputMode={
          field.kind === 'number' || field.kind === 'integer'
            ? 'decimal'
            : undefined
        }
        step={field.kind === 'integer' ? 1 : undefined}
        value={getRunnerConfigFieldValue(field, controllerValue)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

function getRunnerConfigInputType(fieldKind: RunnerConfigField['kind']) {
  if (fieldKind === 'url') {
    return 'url';
  }

  if (fieldKind === 'number' || fieldKind === 'integer') {
    return 'number';
  }

  return 'text';
}
