import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { FormField } from '@/components/app/FormField';
import { StringMapFieldEditor } from '@/components/app/StringMapFieldEditor';
import { Input } from '@/components/ui/input';
import { CompactNativeSelect } from '@/components/ui/native-select';
import {
  getRunnerConfigFieldValue,
  getRunnerConfigSelectOptions,
  shouldRenderEmptyEnumOption,
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
  const fieldId = `${namePrefix.replaceAll('.', '-')}-${field.name}`;

  return (
    <Controller
      control={control}
      name={
        `${namePrefix}.${field.name}` as import('react-hook-form').Path<TFieldValues>
      }
      render={({ field: controllerField, fieldState }) => {
        if (field.kind === 'string_map') {
          return (
            <StringMapFieldEditor
              label={field.label}
              description={field.description}
              fieldId={fieldId}
              error={fieldState.error?.message}
              value={controllerField.value}
              onChange={controllerField.onChange}
            />
          );
        }

        if (field.kind === 'boolean') {
          return (
            <FormField
              label={field.label}
              htmlFor={fieldId}
              description={field.description}
              error={fieldState.error?.message}
            >
              <label className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-3">
                <input
                  id={fieldId}
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
          const optionsToRender = getRunnerConfigSelectOptions(
            field,
            discoveredEnumList
          );

          return (
            <FormField
              label={field.label}
              htmlFor={fieldId}
              description={field.description}
              error={fieldState.error?.message}
            >
              <CompactNativeSelect
                id={fieldId}
                className="w-full rounded-xl bg-background"
                value={getRunnerConfigFieldValue(field, controllerField.value)}
                onChange={(event) =>
                  controllerField.onChange(event.target.value)
                }
              >
                {shouldRenderEmptyEnumOption(field) ? (
                  <option value="">未设置</option>
                ) : null}
                {optionsToRender.map((option) => (
                  <option key={option.value} value={option.value}>
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
            error={fieldState.error?.message}
          >
            <Input
              id={fieldId}
              type={
                field.kind === 'url'
                  ? 'url'
                  : field.kind === 'number' || field.kind === 'integer'
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
