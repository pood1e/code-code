import { Plus, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ListPageToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  createLabel: string;
  refreshLabel: string;
  searchPlaceholder?: string;
  refreshPending?: boolean;
};

export function ListPageToolbar({
  searchValue,
  onSearchChange,
  onRefresh,
  onCreate,
  createLabel,
  refreshLabel,
  searchPlaceholder = '按名称搜索',
  refreshPending = false
}: ListPageToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 rounded-xl pl-10"
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={refreshLabel}
          title={refreshLabel}
          onClick={onRefresh}
          disabled={refreshPending}
        >
          <RefreshCw
            data-icon="inline-start"
            className={refreshPending ? 'animate-spin' : undefined}
          />
          <span className="hidden sm:inline">刷新</span>
        </Button>

        <Button
          size="sm"
          aria-label={createLabel}
          title={createLabel}
          onClick={onCreate}
        >
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">{createLabel}</span>
        </Button>
      </div>
    </div>
  );
}
