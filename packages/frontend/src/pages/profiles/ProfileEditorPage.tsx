import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  ArrowLeftOutlined,
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  message
} from 'antd';
import {
  mcpConfigOverrideSchema,
  profileInputSchema,
  type McpConfigOverride,
  type McpResource,
  type ProfileDetail,
  type ProfileItemsPayload,
  type RuleResource,
  type SkillResource
} from '@agent-workbench/shared';
import { useNavigate, useParams } from 'react-router-dom';

import { useErrorMessage } from '../../api/client';
import {
  getProfile,
  replaceProfileItems,
  updateProfile,
  type ProfilePayload
} from '../../api/profiles';
import { listResources } from '../../api/resources';
import { CodeEditor } from '../../components/JsonEditor';

type ProfileEditorFormValues = {
  name: string;
  description?: string;
};

type ResourceCatalog = {
  skills: SkillResource[];
  mcps: McpResource[];
  rules: RuleResource[];
};

type SelectedBaseItem = {
  resourceId: string;
  name: string;
  description: string | null;
  order: number;
};

type SelectedMcpItem = SelectedBaseItem & {
  command: string;
  configOverride?: McpConfigOverride;
};

type OverrideEditorState = {
  value: string;
  error: string | null;
};

type AvailableResourceItem = {
  id: string;
  name: string;
  description: string | null;
  meta?: string;
};

type SelectedResourceListProps<T extends SelectedBaseItem> = {
  title: string;
  emptyText: string;
  items: T[];
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  renderMeta?: (item: T) => string | null;
  renderDetails?: (item: T) => React.ReactNode;
};

type AvailableResourceListProps = {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: AvailableResourceItem[];
  emptyText: string;
  onAdd: (id: string) => void;
};

function normalizeDescription(description?: string) {
  return description?.trim() ? description.trim() : null;
}

function syncOrders<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index }));
}

function reorderSelectedItems<T extends { resourceId: string; order: number }>(
  items: T[],
  activeId: string,
  overId: string
) {
  const currentIndex = items.findIndex((item) => item.resourceId === activeId);
  const nextIndex = items.findIndex((item) => item.resourceId === overId);

  if (currentIndex === -1 || nextIndex === -1) {
    return items;
  }

  return syncOrders(arrayMove(items, currentIndex, nextIndex));
}

function hasOverrideValue(override?: McpConfigOverride) {
  return Boolean(override && Object.keys(override).length > 0);
}

function normalizeOverride(override?: McpConfigOverride) {
  return hasOverrideValue(override) ? override : undefined;
}

function formatOverrideEditorValue(override?: McpConfigOverride) {
  if (!hasOverrideValue(override)) {
    return '';
  }

  return JSON.stringify(override, null, 2);
}

function parseOverrideEditorValue(value: string) {
  if (!value.trim()) {
    return {
      override: undefined,
      error: null
    };
  }

  try {
    const parsedJson = JSON.parse(value) as unknown;
    const parsedOverride = mcpConfigOverrideSchema.safeParse(parsedJson);

    if (!parsedOverride.success) {
      return {
        override: undefined,
        error:
          parsedOverride.error.issues[0]?.message ?? 'Invalid MCP override.'
      };
    }

    return {
      override: normalizeOverride(parsedOverride.data),
      error: null
    };
  } catch {
    return {
      override: undefined,
      error: 'Override must be valid JSON.'
    };
  }
}

function filterAvailableResources<T extends { id: string; name: string }>(
  items: T[],
  selectedIds: Set<string>,
  searchValue: string
) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return items
    .filter((item) => !selectedIds.has(item.id))
    .filter((item) =>
      normalizedSearch ? item.name.toLowerCase().includes(normalizedSearch) : true
    );
}

function buildInitialCatalog() {
  return {
    skills: [],
    mcps: [],
    rules: []
  } satisfies ResourceCatalog;
}

function buildProfilePayload(values: ProfileEditorFormValues) {
  const parsed = profileInputSchema.safeParse({
    name: values.name,
    description: normalizeDescription(values.description)
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid profile data.');
  }

  return parsed.data satisfies ProfilePayload;
}

function buildProfileItemsPayload(
  selectedSkills: SelectedBaseItem[],
  selectedMcps: SelectedMcpItem[],
  selectedRules: SelectedBaseItem[]
) {
  return {
    skills: syncOrders(selectedSkills).map((item) => ({
      resourceId: item.resourceId,
      order: item.order
    })),
    mcps: syncOrders(selectedMcps).map((item) => ({
      resourceId: item.resourceId,
      order: item.order,
      configOverride: normalizeOverride(item.configOverride)
    })),
    rules: syncOrders(selectedRules).map((item) => ({
      resourceId: item.resourceId,
      order: item.order
    }))
  } satisfies ProfileItemsPayload;
}

function SortableSelectedItem<T extends SelectedBaseItem>({
  item,
  onRemove,
  meta,
  children
}: {
  item: T;
  onRemove: (resourceId: string) => void;
  meta?: string | null;
  children?: React.ReactNode;
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

export function ProfileEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const [form] = Form.useForm<ProfileEditorFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<ResourceCatalog>(buildInitialCatalog);
  const [selectedSkills, setSelectedSkills] = useState<SelectedBaseItem[]>([]);
  const [selectedMcps, setSelectedMcps] = useState<SelectedMcpItem[]>([]);
  const [selectedRules, setSelectedRules] = useState<SelectedBaseItem[]>([]);
  const [expandedMcps, setExpandedMcps] = useState<string[]>([]);
  const [mcpEditorState, setMcpEditorState] = useState<
    Record<string, OverrideEditorState>
  >({});
  const [searchState, setSearchState] = useState({
    skills: '',
    mcps: '',
    rules: ''
  });

  const deferredSkillSearch = useDeferredValue(searchState.skills);
  const deferredMcpSearch = useDeferredValue(searchState.mcps);
  const deferredRuleSearch = useDeferredValue(searchState.rules);

  const applyProfileDetail = useCallback((detail: ProfileDetail) => {
    form.setFieldsValue({
      name: detail.name,
      description: detail.description ?? ''
    });
    setSelectedSkills(
      syncOrders(
        detail.skills.map((item) => ({
          resourceId: item.id,
          name: item.name,
          description: item.description,
          order: item.order
        }))
      )
    );
    const nextMcps = syncOrders(
      detail.mcps.map((item) => ({
        resourceId: item.id,
        name: item.name,
        description: item.description,
        order: item.order,
        command: item.content.command,
        configOverride: normalizeOverride(item.configOverride)
      }))
    );
    setSelectedMcps(nextMcps);
    setSelectedRules(
      syncOrders(
        detail.rules.map((item) => ({
          resourceId: item.id,
          name: item.name,
          description: item.description,
          order: item.order
        }))
      )
    );
    setMcpEditorState(
      Object.fromEntries(
        nextMcps.map((item) => [
          item.resourceId,
          {
            value: formatOverrideEditorValue(item.configOverride),
            error: null
          }
        ])
      )
    );
    setExpandedMcps([]);
  }, [form]);

  useEffect(() => {
    if (!id) {
      void navigate('/profiles', { replace: true });
      return;
    }

    setLoading(true);
    void Promise.all([
      getProfile(id),
      listResources('skills'),
      listResources('mcps'),
      listResources('rules')
    ])
      .then(([detail, skills, mcps, rules]) => {
        setCatalog({ skills, mcps, rules });
        applyProfileDetail(detail);
      })
      .catch((error) => {
        handleError(error);
        void navigate('/profiles');
      })
      .finally(() => setLoading(false));
  }, [applyProfileDetail, handleError, id, navigate]);

  const selectedSkillIds = useMemo(
    () => new Set(selectedSkills.map((item) => item.resourceId)),
    [selectedSkills]
  );
  const selectedMcpIds = useMemo(
    () => new Set(selectedMcps.map((item) => item.resourceId)),
    [selectedMcps]
  );
  const selectedRuleIds = useMemo(
    () => new Set(selectedRules.map((item) => item.resourceId)),
    [selectedRules]
  );

  const availableSkills = useMemo(
    () =>
      filterAvailableResources(
        catalog.skills,
        selectedSkillIds,
        deferredSkillSearch
      ),
    [catalog.skills, deferredSkillSearch, selectedSkillIds]
  );
  const availableMcps = useMemo(
    () =>
      filterAvailableResources(catalog.mcps, selectedMcpIds, deferredMcpSearch),
    [catalog.mcps, deferredMcpSearch, selectedMcpIds]
  );
  const availableRules = useMemo(
    () =>
      filterAvailableResources(catalog.rules, selectedRuleIds, deferredRuleSearch),
    [catalog.rules, deferredRuleSearch, selectedRuleIds]
  );

  const addSkill = (resourceId: string) => {
    const resource = catalog.skills.find((item) => item.id === resourceId);
    if (!resource || selectedSkillIds.has(resourceId)) {
      return;
    }

    setSelectedSkills((current) =>
      syncOrders([
        ...current,
        {
          resourceId,
          name: resource.name,
          description: resource.description,
          order: current.length
        }
      ])
    );
  };

  const addMcp = (resourceId: string) => {
    const resource = catalog.mcps.find((item) => item.id === resourceId);
    if (!resource || selectedMcpIds.has(resourceId)) {
      return;
    }

    setSelectedMcps((current) =>
      syncOrders([
        ...current,
        {
          resourceId,
          name: resource.name,
          description: resource.description,
          order: current.length,
          command: resource.content.command,
          configOverride: undefined
        }
      ])
    );
    setMcpEditorState((current) => ({
      ...current,
      [resourceId]: {
        value: '',
        error: null
      }
    }));
  };

  const addRule = (resourceId: string) => {
    const resource = catalog.rules.find((item) => item.id === resourceId);
    if (!resource || selectedRuleIds.has(resourceId)) {
      return;
    }

    setSelectedRules((current) =>
      syncOrders([
        ...current,
        {
          resourceId,
          name: resource.name,
          description: resource.description,
          order: current.length
        }
      ])
    );
  };

  const updateMcpOverride = (resourceId: string, value: string) => {
    const parsed = parseOverrideEditorValue(value);

    setMcpEditorState((current) => ({
      ...current,
      [resourceId]: {
        value,
        error: parsed.error
      }
    }));
    setSelectedMcps((current) =>
      current.map((item) =>
        item.resourceId === resourceId
          ? { ...item, configOverride: parsed.override }
          : item
      )
    );
  };

  const saveProfile = async () => {
    if (!id) {
      return;
    }

    const invalidOverride = Object.values(mcpEditorState).find(
      (item) => item.error
    );
    if (invalidOverride) {
      void message.error('请先修正 MCP override 的 JSON。');
      return;
    }

    let profilePayload: ProfilePayload;
    try {
      const values = await form.validateFields();
      profilePayload = buildProfilePayload(values);
    } catch (error) {
      if (error instanceof Error) {
        void message.error(error.message);
      }
      return;
    }

    const itemsPayload = buildProfileItemsPayload(
      selectedSkills,
      selectedMcps,
      selectedRules
    );

    setSaving(true);
    try {
      await updateProfile(id, profilePayload);
      const detail = await replaceProfileItems(id, itemsPayload);
      applyProfileDetail(detail);
      void message.success('Profile saved');
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="page-card" loading={loading}>
      <div className="page-card__header">
        <div>
          <Typography.Title level={2} className="page-card__title">
            Profile Editor
          </Typography.Title>
          <Typography.Paragraph className="page-card__description">
            编辑基础信息、关联资源和 MCP override
          </Typography.Paragraph>
        </div>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => void navigate('/profiles')}
          >
            Back
          </Button>
          <Button type="primary" loading={saving} onClick={() => void saveProfile()}>
            Save
          </Button>
        </Space>
      </div>

      <Form<ProfileEditorFormValues>
        layout="vertical"
        form={form}
        className="profile-editor__form"
      >
        <div className="profile-editor__form-grid">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Profile name is required' }]}
          >
            <Input placeholder="Profile name" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="描述" />
          </Form.Item>
        </div>
      </Form>

      <div className="profile-editor__sections">
        <Card className="profile-editor__section-card">
          <Typography.Title level={3}>Skills</Typography.Title>
          <div className="profile-editor__section-grid">
            <AvailableResourceList
              title="可选资源"
              searchValue={searchState.skills}
              onSearchChange={(value) =>
                setSearchState((current) => ({ ...current, skills: value }))
              }
              items={availableSkills.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description
              }))}
              emptyText="没有可添加的 Skill"
              onAdd={addSkill}
            />
            <SelectedResourceList
              title="已选资源"
              emptyText="还没有选中的 Skill"
              items={selectedSkills}
              onRemove={(resourceId) =>
                setSelectedSkills((current) =>
                  syncOrders(
                    current.filter((item) => item.resourceId !== resourceId)
                  )
                )
              }
              onReorder={(activeId, overId) =>
                setSelectedSkills((current) =>
                  reorderSelectedItems(current, activeId, overId)
                )
              }
            />
          </div>
        </Card>

        <Card className="profile-editor__section-card">
          <Typography.Title level={3}>MCPs</Typography.Title>
          <div className="profile-editor__section-grid">
            <AvailableResourceList
              title="可选资源"
              searchValue={searchState.mcps}
              onSearchChange={(value) =>
                setSearchState((current) => ({ ...current, mcps: value }))
              }
              items={availableMcps.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                meta: item.content.command
              }))}
              emptyText="没有可添加的 MCP"
              onAdd={addMcp}
            />
            <SelectedResourceList
              title="已选资源"
              emptyText="还没有选中的 MCP"
              items={selectedMcps}
              onRemove={(resourceId) => {
                setSelectedMcps((current) =>
                  syncOrders(
                    current.filter((item) => item.resourceId !== resourceId)
                  )
                );
                setExpandedMcps((current) =>
                  current.filter((item) => item !== resourceId)
                );
                setMcpEditorState((current) => {
                  const next = { ...current };
                  delete next[resourceId];
                  return next;
                });
              }}
              onReorder={(activeId, overId) =>
                setSelectedMcps((current) =>
                  reorderSelectedItems(current, activeId, overId)
                )
              }
              renderMeta={(item) => item.command}
              renderDetails={(item) => {
                const isExpanded = expandedMcps.includes(item.resourceId);
                const editor = mcpEditorState[item.resourceId] ?? {
                  value: '',
                  error: null
                };

                return (
                  <div className="profile-editor__override">
                    <Button
                      type="link"
                      onClick={() =>
                        setExpandedMcps((current) =>
                          current.includes(item.resourceId)
                            ? current.filter((entry) => entry !== item.resourceId)
                            : [...current, item.resourceId]
                        )
                      }
                    >
                      {isExpanded ? '收起 override' : '编辑 override'}
                    </Button>
                    {isExpanded ? (
                      <div className="profile-editor__override-editor">
                        <Typography.Paragraph className="profile-editor__hint">
                          仅填写需要覆盖的字段。留空表示不覆盖。
                        </Typography.Paragraph>
                        <CodeEditor
                          value={editor.value}
                          onChange={(value) =>
                            updateMcpOverride(item.resourceId, value)
                          }
                        />
                        {editor.error ? (
                          <Typography.Text type="danger">
                            {editor.error}
                          </Typography.Text>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>
        </Card>

        <Card className="profile-editor__section-card">
          <Typography.Title level={3}>Rules</Typography.Title>
          <div className="profile-editor__section-grid">
            <AvailableResourceList
              title="可选资源"
              searchValue={searchState.rules}
              onSearchChange={(value) =>
                setSearchState((current) => ({ ...current, rules: value }))
              }
              items={availableRules.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description
              }))}
              emptyText="没有可添加的 Rule"
              onAdd={addRule}
            />
            <SelectedResourceList
              title="已选资源"
              emptyText="还没有选中的 Rule"
              items={selectedRules}
              onRemove={(resourceId) =>
                setSelectedRules((current) =>
                  syncOrders(
                    current.filter((item) => item.resourceId !== resourceId)
                  )
                )
              }
              onReorder={(activeId, overId) =>
                setSelectedRules((current) =>
                  reorderSelectedItems(current, activeId, overId)
                )
              }
            />
          </div>
        </Card>
      </div>
    </Card>
  );
}
