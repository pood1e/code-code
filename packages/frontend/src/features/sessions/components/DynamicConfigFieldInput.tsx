import { Plus, Trash2 } from 'lucide-react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { FormField } from '@/components/app/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompactNativeSelect } from '@/components/ui/native-select';
import {
  getRunnerConfigFieldValue,
  getRunnerConfigSelectOptions,
  shouldRenderEmptyEnumOption,
  toStringMapEntries,
  toStringMapObject,
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
          const entries = toStringMapEntries(controllerField.value);

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
            controllerField.onChange(toStringMapObject(nextEntries));
          };

          const removeEntry = (index: number) => {
            const nextEntries = entries.filter((_, entryIndex) => entryIndex !== index);
            controllerField.onChange(toStringMapObject(nextEntries));
          };

          const appendEntry = () => {
            controllerField.onChange(
              toStringMapObject([...entries, { key: '', value: '' }])
            );
          };

          return (
            <FormField
              label={field.label}
              htmlFor={fieldId}
              description={field.description}
              error={fieldState.error?.message}
            >
              <div className="space-y-3 rounded-lg border border-border/40 px-3 py-3">
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
