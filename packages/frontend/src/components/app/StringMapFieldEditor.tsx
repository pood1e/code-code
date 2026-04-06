import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  toStringMapEntries,
  toStringMapObject,
  type StringMapEntry
} from '@/lib/runner-config-schema';

import { FormField } from './FormField';

export function StringMapFieldEditor({
  description,
  error,
  fieldId,
  label,
  value,
  onChange
}: {
  description?: string;
  error?: string;
  fieldId: string;
  label: string;
  value: unknown;
  onChange: (nextValue: Record<string, string>) => void;
}) {
  const committedEntries = useMemo(() => toStringMapEntries(value), [value]);
  const committedSnapshot = useMemo(
    () => JSON.stringify(committedEntries),
    [committedEntries]
  );
  const [draftEntries, setDraftEntries] = useState<StringMapEntry[]>(
    committedEntries
  );

  useEffect(() => {
    setDraftEntries(committedEntries);
  }, [committedEntries, committedSnapshot]);

  const updateEntries = (nextEntries: StringMapEntry[]) => {
    setDraftEntries(nextEntries);
    onChange(toStringMapObject(nextEntries));
  };

  const appendEntry = () => {
    setDraftEntries((currentEntries) => [
      ...currentEntries,
      { key: '', value: '' }
    ]);
  };

  const updateEntry = (
    index: number,
    key: keyof StringMapEntry,
    nextValue: string
  ) => {
    const nextEntries =
      draftEntries.length > 0
        ? [...draftEntries]
        : [{ key: '', value: '' }];
    nextEntries[index] = {
      ...nextEntries[index],
      [key]: nextValue
    };
    updateEntries(nextEntries);
  };

  const removeEntry = (index: number) => {
    const nextEntries = draftEntries.filter(
      (_, entryIndex) => entryIndex !== index
    );
    updateEntries(nextEntries);
  };

  return (
    <FormField
      label={label}
      htmlFor={fieldId}
      description={description}
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
            aria-label={`添加${label}`}
            onClick={appendEntry}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {draftEntries.length > 0 ? (
          draftEntries.map((entry, index) => (
            <div
              key={`${fieldId}-${index}`}
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
                aria-label={`移除${label} ${index + 1}`}
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
