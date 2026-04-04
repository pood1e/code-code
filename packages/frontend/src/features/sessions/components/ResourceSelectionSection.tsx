import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ResourceByKind } from '@agent-workbench/shared';

import { Button } from '@/components/ui/button';
import { CompactNativeSelect } from '@/components/ui/native-select';

export function ResourceSelectionSection<
  K extends 'skills' | 'mcps' | 'rules'
>({
  label,
  items,
  value,
  onToggle,
  getHint
}: {
  label: string;
  items: ResourceByKind[K][];
  value: string[];
  onToggle: (resourceId: string) => void;
  getHint?: (item: ResourceByKind[K]) => string | undefined;
}) {
  const [pendingResourceId, setPendingResourceId] = useState('');
  const selectedItems = useMemo(
    () =>
      value
        .map((resourceId) => items.find((item) => item.id === resourceId))
        .filter(Boolean),
    [items, value]
  );
  const availableItems = useMemo(
    () => items.filter((item) => !value.includes(item.id)),
    [items, value]
  );

  const handleAdd = () => {
    if (!pendingResourceId) {
      return;
    }

    onToggle(pendingResourceId);
    setPendingResourceId('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="text-xs text-muted-foreground">
          已选 {value.length}
        </span>
      </div>

      <div className="flex gap-2">
        <CompactNativeSelect
          aria-label={`选择${label}`}
          className="min-w-0 w-full flex-1 rounded-xl bg-background"
          value={pendingResourceId}
          onChange={(event) => setPendingResourceId(event.target.value)}
          disabled={availableItems.length === 0}
        >
          <option value="">
            {availableItems.length === 0
              ? `没有可添加的${label}`
              : `选择一个${label}`}
          </option>
          {availableItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </CompactNativeSelect>
        <Button
          type="button"
          variant="outline"
          aria-label={`添加${label}`}
          onClick={handleAdd}
          disabled={!pendingResourceId}
        >
          <Plus />
          添加
        </Button>
      </div>

      <div className="min-h-24 space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-3">
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">未添加</p>
        ) : (
          selectedItems.map((item) => {
            if (!item) {
              return null;
            }

            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/75 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {getHint?.(item) ?? item.description?.trim() ?? item.id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`移除 ${item.name}`}
                  onClick={() => onToggle(item.id)}
                  className="shrink-0"
                >
                  <X />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
