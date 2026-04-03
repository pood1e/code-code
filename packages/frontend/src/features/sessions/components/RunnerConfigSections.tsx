import type { SchemaDescriptor } from '@agent-workbench/shared';
import { useMemo } from 'react';
import { parseRunnerConfigSchema, type RunnerConfigField } from '@/lib/runner-config-schema';
import { SetupSection } from './SetupSection';

function formatConfigValue(value: unknown) {
  if (value == null) {
    return '未设置';
  }

  if (typeof value === 'boolean') {
    return value ? '启用' : '关闭';
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function formatFieldKindLabel(field: RunnerConfigField) {
  switch (field.kind) {
    case 'string':
      return 'string';
    case 'url':
      return 'url';
    case 'number':
      return 'number';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    default:
      return field.kind;
  }
}

export function ReadonlyRunnerConfigSection({
  title,
  schema,
  values,
  emptyLabel = '未配置'
}: {
  title: string;
  schema: SchemaDescriptor | undefined;
  values: Record<string, unknown> | undefined;
  emptyLabel?: string;
}) {
  const parsedSchema = useMemo(() => parseRunnerConfigSchema(schema), [schema]);
  const hasValues = Boolean(values && Object.keys(values).length > 0);

  return (
    <SetupSection title={title}>
      {!hasValues ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : parsedSchema.supported && parsedSchema.fields.length > 0 ? (
        <div className="space-y-3">
          {parsedSchema.fields.map((field) => (
            <div
              key={field.name}
              className="rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {formatFieldKindLabel(field)}
                </span>
              </div>
              {field.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/30 px-2 py-1.5 text-xs text-foreground">
                {formatConfigValue(values?.[field.name])}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
          {JSON.stringify(values, null, 2)}
        </pre>
      )}
    </SetupSection>
  );
}

export function RunnerSchemaSection({
  title,
  schema,
  description,
  emptyLabel = '当前未提供 schema'
}: {
  title: string;
  schema: SchemaDescriptor | undefined;
  description?: string;
  emptyLabel?: string;
}) {
  const parsedSchema = useMemo(() => parseRunnerConfigSchema(schema), [schema]);

  return (
    <SetupSection title={title} description={description}>
      {!schema ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : parsedSchema.supported && parsedSchema.fields.length > 0 ? (
        <div className="space-y-3">
          {parsedSchema.fields.map((field) => (
            <div
              key={field.name}
              className="rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{field.label}</p>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{formatFieldKindLabel(field)}</span>
                  {field.required ? <span>required</span> : null}
                </div>
              </div>
              {field.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {field.description}
                </p>
              ) : null}
              {field.defaultValue !== undefined ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  默认值: {formatConfigValue(field.defaultValue)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-foreground">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </SetupSection>
  );
}
