import { Input } from '@/components/ui/input';
import { CompactNativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  getRunnerConfigFieldValue,
  getRunnerConfigSelectOptions,
  shouldRenderEmptyEnumOption,
  type RunnerConfigField
} from '@/lib/runner-config-schema';

type ThreadComposerConfigFieldProps = {
  disabled: boolean;
  field: RunnerConfigField;
  onChange: (fieldName: string, value: unknown) => void;
  value: unknown;
  options?: Array<{ label: string; value: string } | string>;
};

export type ThreadComposerDiscoveredOptions = Record<
  string,
  Array<{ label: string; value: string } | string>
>;

export function ThreadComposerRuntimeFields({
  disabled,
  discoveredOptions,
  fields,
  onChange,
  values
}: {
  disabled: boolean;
  discoveredOptions?: ThreadComposerDiscoveredOptions;
  fields: RunnerConfigField[];
  onChange: (fieldName: string, value: unknown) => void;
  values: Record<string, unknown>;
}) {
  return fields.map((field) => (
    <CompactComposerFieldControl
      key={field.name}
      disabled={disabled}
      field={field}
      onChange={onChange}
      options={
        field.contextKey && discoveredOptions
          ? discoveredOptions[field.contextKey]
          : undefined
      }
      value={values[field.name]}
    />
  ));
}

export function AdditionalInputFields({
  disabled,
  fields,
  onChange,
  values
}: {
  disabled: boolean;
  fields: RunnerConfigField[];
  onChange: (fieldName: string, value: unknown) => void;
  values: Record<string, unknown>;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground">
        高级输入
      </summary>
      <div className="absolute bottom-full left-0 z-10 mb-2 w-80 max-h-80 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur group-open:animate-in group-open:fade-in-0 group-open:zoom-in-95">
        <div className="space-y-4">
          {fields.map((field) => (
            <AdditionalInputFieldControl
              key={field.name}
              disabled={disabled}
              field={field}
              onChange={onChange}
              value={values[field.name]}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function AdditionalInputFieldControl({
  disabled,
  field,
  onChange,
  value
}: Omit<ThreadComposerConfigFieldProps, 'options'>) {
  const fieldId = `composer-additional-${field.name}`;

  if (field.kind === 'boolean') {
    return (
      <label
        htmlFor={fieldId}
        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"
      >
        <ThreadComposerFieldLabel field={field} />
        <input
          id={fieldId}
          type="checkbox"
          className="size-4"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.checked)}
        />
      </label>
    );
  }

  if (field.kind === 'enum') {
    return (
      <div className="space-y-2">
        <ThreadComposerFieldHeader field={field} fieldId={fieldId} />
        <CompactNativeSelect
          id={fieldId}
          aria-label={field.label}
          className="w-full"
          value={getRunnerConfigFieldValue(field, value)}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          {renderComposerSelectOptions(field)}
        </CompactNativeSelect>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ThreadComposerFieldHeader field={field} fieldId={fieldId} />
      <ThreadComposerTextField
        disabled={disabled}
        field={field}
        fieldId={fieldId}
        onChange={onChange}
        value={value}
      />
    </div>
  );
}

function CompactComposerFieldControl({
  disabled,
  field,
  onChange,
  options,
  value
}: ThreadComposerConfigFieldProps) {
  if (field.kind === 'enum' || (Array.isArray(options) && options.length > 0)) {
    return (
      <CompactNativeSelect
        key={field.name}
        aria-label={field.label}
        className="h-7 w-full border-border/50 bg-background/70 text-[11px] text-muted-foreground hover:text-foreground"
        containerClassName="max-w-[132px]"
        disabled={disabled}
        title={field.label}
        value={getRunnerConfigFieldValue(field, value)}
        onChange={(event) => onChange(field.name, event.target.value)}
      >
        {renderComposerSelectOptions(field, options)}
      </CompactNativeSelect>
    );
  }

  return (
    <Input
      key={field.name}
      aria-label={field.label}
      placeholder={field.label}
      value={getRunnerConfigFieldValue(field, value)}
      disabled={disabled}
      onChange={(event) => onChange(field.name, event.target.value)}
      className="h-7 max-w-[112px] rounded-full border border-border/50 bg-background/70 px-3 text-[11px] text-foreground placeholder:text-muted-foreground/55 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function ThreadComposerTextField({
  disabled,
  field,
  fieldId,
  onChange,
  value
}: Omit<ThreadComposerConfigFieldProps, 'options'> & {
  fieldId: string;
}) {
  if (field.kind === 'string') {
    return (
      <Textarea
        id={fieldId}
        aria-label={field.label}
        rows={3}
        value={getRunnerConfigFieldValue(field, value)}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
      />
    );
  }

  return (
    <Input
      id={fieldId}
      aria-label={field.label}
      type={getComposerInputType(field.kind)}
      value={getRunnerConfigFieldValue(field, value)}
      disabled={disabled}
      onChange={(event) => onChange(field.name, event.target.value)}
    />
  );
}

function ThreadComposerFieldHeader({
  field,
  fieldId
}: {
  field: RunnerConfigField;
  fieldId: string;
}) {
  return (
    <>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-foreground"
      >
        {field.label}
      </label>
      {field.description ? (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      ) : null}
    </>
  );
}

function ThreadComposerFieldLabel({ field }: { field: RunnerConfigField }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{field.label}</p>
      {field.description ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {field.description}
        </p>
      ) : null}
    </div>
  );
}

function renderComposerSelectOptions(
  field: RunnerConfigField,
  discoveredOptions?: Array<{ label: string; value: string } | string>
) {
  const options = getRunnerConfigSelectOptions(field, discoveredOptions);

  return (
    <>
      {shouldRenderEmptyEnumOption(field) ? (
        <option value="">未设置</option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
}

function getComposerInputType(fieldKind: RunnerConfigField['kind']) {
  if (fieldKind === 'url') {
    return 'url';
  }

  if (fieldKind === 'number' || fieldKind === 'integer') {
    return 'number';
  }

  return 'text';
}
