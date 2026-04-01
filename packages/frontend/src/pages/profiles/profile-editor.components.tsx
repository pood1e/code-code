import {
  DeleteOutlined,
  MenuOutlined,
  PlusOutlined
} from '@ant-design/icons';
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
import {
  Button,
  Card,
  Empty,
  Input,
  Space,
  Tag,
  Typography
} from 'antd';
import type { ReactNode } from 'react';

import type {
  AvailableResourceListProps,
  BaseSectionConfig,
  McpSectionConfig,
  SelectedBaseItem,
  SelectedResourceListProps
} from './profile-editor.utils';

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
      className={`profile-editor__selected-item${
        isDragging ? ' profile-editor__selected-item--dragging' : ''
      }`}
    >
      <div className="profile-editor__selected-item-main">
        <Button
          type="text"
          icon={<MenuOutlined />}
          className="profile-editor__drag-handle"
          {...attributes}
          {...listeners}
        />
        <div className="profile-editor__selected-copy">
          <Space size={8} wrap>
            <Typography.Text strong>{item.name}</Typography.Text>
            <Tag>{item.order + 1}</Tag>
            {meta ? <Tag color="blue">{meta}</Tag> : null}
          </Space>
          <Typography.Paragraph className="profile-editor__item-description">
            {item.description ?? '无描述'}
          </Typography.Paragraph>
          {children}
        </div>
      </div>
      <Button
        type="text"
        danger
        icon={<DeleteOutlined />}
        onClick={() => onRemove(item.resourceId)}
      />
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
    <div className="profile-editor__panel">
      <div className="profile-editor__panel-header">
        <Typography.Title level={4}>{title}</Typography.Title>
        <Tag>{items.length}</Tag>
      </div>
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
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
            <div className="profile-editor__selected-list">
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
    </div>
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
    <div className="profile-editor__panel">
      <div className="profile-editor__panel-header">
        <Typography.Title level={4}>{title}</Typography.Title>
        <Tag>{items.length}</Tag>
      </div>
      <Input
        allowClear
        placeholder="按名称搜索"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="profile-editor__available-list">
        {items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        ) : (
          items.map((item) => (
            <div key={item.id} className="profile-editor__available-item">
              <div className="profile-editor__available-copy">
                <Space size={8} wrap>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  {item.meta ? <Tag color="blue">{item.meta}</Tag> : null}
                </Space>
                <Typography.Paragraph className="profile-editor__item-description">
                  {item.description ?? '无描述'}
                </Typography.Paragraph>
              </div>
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => onAdd(item.id)}
              >
                添加
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ResourceSectionCard<T extends SelectedBaseItem>({
  section,
  renderMeta,
  renderDetails
}: {
  section: BaseSectionConfig | McpSectionConfig;
  renderMeta?: (item: T) => string | null;
  renderDetails?: (item: T) => ReactNode;
}) {
  return (
    <Card className="profile-editor__section-card">
      <Typography.Title level={3}>{section.title}</Typography.Title>
      <div className="profile-editor__section-grid">
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
          items={section.selectedItems as T[]}
          onRemove={section.onRemove}
          onReorder={section.onReorder}
          renderMeta={renderMeta}
          renderDetails={renderDetails}
        />
      </div>
    </Card>
  );
}
