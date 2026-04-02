import {
  Delete,
  GripVertical,
  Plus,
  Search
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import type {
  AvailableResourceListProps,
  BaseSectionConfig,
  McpSectionConfig,
  SelectedBaseItem,
  SelectedResourceListProps
} from './profile-editor.utils';

const panelItemClassName =
  'flex items-start justify-between gap-3 rounded-2xl border border-border/40 bg-background/80 p-3.5';

function SortableSelectedItem<T extends SelectedBaseItem>({
  item,
  onRemove,
  meta,
  children
}: {
  item: T;
  onRemove: (resourceId: string) => void;
  meta?: string | null;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.resourceId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        `${panelItemClassName} transition-shadow`,
        isDragging ? 'shadow-[0_20px_44px_-28px_rgba(15,23,42,0.4)]' : ''
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="mt-0.5 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{item.name}</p>
            <Badge variant="secondary">#{item.order + 1}</Badge>
            {meta ? <Badge variant="outline">{meta}</Badge> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {item.description ?? '暂无描述'}
          </p>
          {children}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Remove ${item.name}`}
        title={`Remove ${item.name}`}
        onClick={() => onRemove(item.resourceId)}
      >
        <Delete />
      </Button>
    </div>
  );
}

function SelectedResourceList<T extends SelectedBaseItem>({
  title,
  emptyText,
  items,
  onRemove,
  onReorder,
  renderMeta,
  renderDetails
}: SelectedResourceListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    onReorder(String(active.id), String(over.id));
  };

  return (
    <SurfaceCard className="rounded-2xl p-4 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="暂无已选资源"
          description={emptyText}
          className="py-10"
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.resourceId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {items.map((item) => (
                <SortableSelectedItem
                  key={item.resourceId}
                  item={item}
                  onRemove={onRemove}
                  meta={renderMeta?.(item)}
                >
                  {renderDetails?.(item)}
                </SortableSelectedItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </SurfaceCard>
  );
}

function AvailableResourceList({
  title,
  searchValue,
  onSearchChange,
  items,
  emptyText,
  onAdd
}: AvailableResourceListProps) {
  return (
    <SurfaceCard className="rounded-2xl p-4 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="按名称搜索"
          className="h-10 rounded-xl pl-10"
        />
      </div>

      <div className="grid gap-3">
        {items.length === 0 ? (
          <EmptyState
            title="暂无可选资源"
            description={emptyText}
            className="py-10"
          />
        ) : (
          items.map((item) => (
            <div key={item.id} className={panelItemClassName}>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.meta ? <Badge variant="outline">{item.meta}</Badge> : null}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description ?? '暂无描述'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Add ${item.name}`}
                title={`Add ${item.name}`}
                onClick={() => onAdd(item.id)}
              >
                <Plus />
              </Button>
            </div>
          ))
        )}
      </div>
    </SurfaceCard>
  );
}

export function ResourceSectionCard<T extends SelectedBaseItem>({
  section,
  renderMeta,
  renderDetails
}: {
  section:
    | (BaseSectionConfig & { selectedItems: T[] })
    | (McpSectionConfig & { selectedItems: T[] });
  renderMeta?: (item: T) => string | null;
  renderDetails?: (item: T) => ReactNode;
}) {
  return (
    <SurfaceCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
        <Badge variant="outline">{section.selectedItems.length}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <AvailableResourceList
          title="可选资源"
          searchValue={section.searchValue}
          onSearchChange={section.onSearchChange}
          items={section.availableItems}
          emptyText={section.emptyAvailableText}
          onAdd={section.onAdd}
        />
        <SelectedResourceList
          title="已选资源"
          emptyText={section.emptySelectedText}
          items={section.selectedItems}
          onRemove={section.onRemove}
          onReorder={section.onReorder}
          renderMeta={renderMeta}
          renderDetails={renderDetails}
        />
      </div>
    </SurfaceCard>
  );
}
