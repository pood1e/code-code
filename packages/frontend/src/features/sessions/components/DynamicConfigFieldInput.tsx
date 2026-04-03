import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { FormField } from '@/components/app/FormField';
import { Input } from '@/components/ui/input';
import {
  getRunnerConfigFieldValue,
  type RunnerConfigField
} from '@/lib/runner-config-schema';

export function DynamicConfigFieldInput<TFieldValues extends FieldValues>({
  field,
  namePrefix,
  control,
  discoveredOptions
}: {
  field: RunnerConfigField;
  namePrefix: string;
  control: Control<TFieldValues>;
  discoveredOptions?: Record<
    string,
    Array<{ label: string; value: string } | string>
  >;
}) {
  return (
    <Controller
      control={control}
      name={
        `${namePrefix}.${field.name}` as import('react-hook-form').Path<TFieldValues>
      }
      render={({ field: controllerField, fieldState }) => {
        if (field.kind === 'boolean') {
          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <label className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={Boolean(controllerField.value)}
                  onChange={(event) =>
                    controllerField.onChange(event.target.checked)
                  }
                />
                <span className="text-sm text-foreground">启用</span>
              </label>
            </FormField>
          );
        }

        const discoveredEnumList =
          field.contextKey && discoveredOptions
            ? discoveredOptions[field.contextKey]
            : undefined;
        const hasDiscoveredEnums =
          Array.isArray(discoveredEnumList) && discoveredEnumList.length > 0;

        if (field.kind === 'enum' || hasDiscoveredEnums) {
          let optionsToRender: { label: string; value: string }[] = [];
          if (hasDiscoveredEnums) {
            optionsToRender = discoveredEnumList.map((item) =>
              typeof item === 'string' ? { label: item, value: item } : item
            );
          } else if (field.enumOptions) {
            optionsToRender = field.enumOptions.map((opt) => ({
              label: opt.label,
              value: String(opt.value)
            }));
          }

          return (
            <FormField
              label={field.label}
              description={field.description}
              error={fieldState.error?.message}
            >
              <select
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50"
                value={getRunnerConfigFieldValue(field, controllerField.value)}
                onChange={(event) =>
                  controllerField.onChange(event.target.value)
                }
              >
                {!field.required ? <option value="">未设置</option> : null}
                {optionsToRender.map((option) => (
                  <option key={option.value} value={option.value}>
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
                field.kind === 'number' || field.kind === 'integer'
                  ? 'number'
                  : 'text'
              }
              value={getRunnerConfigFieldValue(field, controllerField.value)}
              onChange={(event) => controllerField.onChange(event.target.value)}
            />
          </FormField>
        );
      }}
    />
  );
}
