import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import type { ResourceByKind } from '@agent-workbench/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SessionResourceEntry = {
  id: string;
  kind: 'skill' | 'rule' | 'mcp';
  label: string;
  name: string;
  hint: string;
};

export function SessionResourcePicker({
  resources,
  selectedSkillIds,
  selectedRuleIds,
  selectedMcpIds,
  onToggleSelection
}: {
  resources: {
    skills: ResourceByKind['skills'][];
    rules: ResourceByKind['rules'][];
    mcps: ResourceByKind['mcps'][];
  };
  selectedSkillIds: string[];
  selectedRuleIds: string[];
  selectedMcpIds: string[];
  onToggleSelection: (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(
    () => [
      ...resources.skills.map<SessionResourceEntry>((item) => ({
        id: item.id,
        kind: 'skill',
        label: 'Skill',
        name: item.name,
        hint: item.description?.trim() || item.id
      })),
      ...resources.rules.map<SessionResourceEntry>((item) => ({
        id: item.id,
        kind: 'rule',
        label: 'Rule',
        name: item.name,
        hint: item.description?.trim() || item.id
      })),
      ...resources.mcps.map<SessionResourceEntry>((item) => ({
        id: item.id,
        kind: 'mcp',
        label: 'MCP',
        name: item.name,
        hint:
          typeof item.content === 'object' && item.content
            ? item.content.command
            : item.description?.trim() || item.id
      }))
    ],
    [resources.mcps, resources.rules, resources.skills]
  );

  const selectedEntries = useMemo(
    () =>
      entries.filter((entry) =>
        isSelected(entry, selectedSkillIds, selectedRuleIds, selectedMcpIds)
      ),
    [entries, selectedMcpIds, selectedRuleIds, selectedSkillIds]
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      [entry.name, entry.label, entry.hint]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [entries, query]);

  const groupedEntries = useMemo(
    () => ({
      skill: filteredEntries.filter((entry) => entry.kind === 'skill'),
      rule: filteredEntries.filter((entry) => entry.kind === 'rule'),
      mcp: filteredEntries.filter((entry) => entry.kind === 'mcp')
    }),
    [filteredEntries]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">附加资源</p>
          <p className="text-xs text-muted-foreground">
            将 Skills、Rules、MCP 挂到当前会话
          </p>
        </div>
        <div ref={containerRef} className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-label="添加资源"
            className="h-8 rounded-full px-3"
            onClick={() => setOpen((current) => !current)}
          >
            <Plus className="size-3.5" />
            添加资源
          </Button>

          {open ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="搜索资源"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 Skill、Rule、MCP"
                  className="pl-9"
                />
              </div>

              <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
                <ResourceGroup
                  title="Skills"
                  items={groupedEntries.skill}
                  selectedSkillIds={selectedSkillIds}
                  selectedRuleIds={selectedRuleIds}
                  selectedMcpIds={selectedMcpIds}
                  onToggleSelection={onToggleSelection}
                />
                <ResourceGroup
                  title="Rules"
                  items={groupedEntries.rule}
                  selectedSkillIds={selectedSkillIds}
                  selectedRuleIds={selectedRuleIds}
                  selectedMcpIds={selectedMcpIds}
                  onToggleSelection={onToggleSelection}
                />
                <ResourceGroup
                  title="MCPs"
                  items={groupedEntries.mcp}
                  selectedSkillIds={selectedSkillIds}
                  selectedRuleIds={selectedRuleIds}
                  selectedMcpIds={selectedMcpIds}
                  onToggleSelection={onToggleSelection}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selectedEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 px-3 py-2 text-sm text-muted-foreground">
          未附加资源
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedEntries.map((entry) => (
            <Badge
              key={entry.id}
              title={entry.hint}
              variant="secondary"
              className={cn(
                'h-auto gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                entry.kind === 'skill' && 'bg-sky-500/10 text-sky-700',
                entry.kind === 'rule' && 'bg-amber-500/10 text-amber-700',
                entry.kind === 'mcp' && 'bg-emerald-500/10 text-emerald-700'
              )}
            >
              <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {entry.label}
              </span>
              <span>{entry.name}</span>
              <button
                type="button"
                aria-label={`移除 ${entry.name}`}
                onClick={() =>
                  onToggleSelection(getFieldName(entry.kind), entry.id)
                }
                className="rounded-full p-0.5 text-current/70 transition-colors hover:bg-background/80 hover:text-current"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceGroup({
  title,
  items,
  selectedSkillIds,
  selectedRuleIds,
  selectedMcpIds,
  onToggleSelection
}: {
  title: string;
  items: SessionResourceEntry[];
  selectedSkillIds: string[];
  selectedRuleIds: string[];
  selectedMcpIds: string[];
  onToggleSelection: (
    fieldName: 'skillIds' | 'ruleIds' | 'mcpIds',
    resourceId: string
  ) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        <span className="text-[11px] text-muted-foreground">
          {items.length} 项
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs text-muted-foreground">
          无匹配结果
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((entry) => {
            const selected = isSelected(
              entry,
              selectedSkillIds,
              selectedRuleIds,
              selectedMcpIds
            );

            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleSelection(getFieldName(entry.kind), entry.id)}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/40 bg-background/70 hover:bg-accent/40'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {entry.name}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {entry.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {entry.hint}
                  </p>
                </div>
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/60 text-transparent'
                  )}
                >
                  <Check className="size-3" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function isSelected(
  entry: SessionResourceEntry,
  selectedSkillIds: string[],
  selectedRuleIds: string[],
  selectedMcpIds: string[]
) {
  if (entry.kind === 'skill') {
    return selectedSkillIds.includes(entry.id);
  }

  if (entry.kind === 'rule') {
    return selectedRuleIds.includes(entry.id);
  }

  return selectedMcpIds.includes(entry.id);
}

function getFieldName(kind: SessionResourceEntry['kind']) {
  if (kind === 'skill') {
    return 'skillIds';
  }

  if (kind === 'rule') {
    return 'ruleIds';
  }

  return 'mcpIds';
}
