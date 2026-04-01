import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  useMutation,
  useQueries,
  useQueryClient
} from '@tanstack/react-query';
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
import { queryKeys } from '../../query/query-keys';

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

type SearchState = {
  skills: string;
  mcps: string;
  rules: string;
};

type BaseSectionConfig = {
  key: 'skills' | 'rules';
  title: 'Skills' | 'Rules';
  emptyAvailableText: string;
  emptySelectedText: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  availableItems: AvailableResourceItem[];
  selectedItems: SelectedBaseItem[];
  onAdd: (resourceId: string) => void;
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
};

type McpSectionConfig = {
  key: 'mcps';
  title: 'MCPs';
  emptyAvailableText: string;
  emptySelectedText: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  availableItems: AvailableResourceItem[];
  selectedItems: SelectedMcpItem[];
  onAdd: (resourceId: string) => void;
  onRemove: (resourceId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
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

function toAvailableItems<T extends { id: string; name: string; description: string | null }>(
  items: T[],
  meta?: (item: T) => string | undefined
) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    meta: meta?.(item)
  }));
}

function removeSelectedItem<T extends { resourceId: string; order: number }>(
  items: T[],
  resourceId: string
) {
  return syncOrders(items.filter((item) => item.resourceId !== resourceId));
}

function toSelectedBaseItems(
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    order: number;
  }>
) {
  return syncOrders(
    items.map((item) => ({
      resourceId: item.id,
      name: item.name,
      description: item.description,
      order: item.order
    }))
  );
}

function toSelectedMcpItems(items: ProfileDetail['mcps']) {
  return syncOrders(
    items.map((item) => ({
      resourceId: item.id,
      name: item.name,
      description: item.description,
      order: item.order,
      command: item.content.command,
      configOverride: normalizeOverride(item.configOverride)
    }))
  );
}

function buildMcpEditorState(items: SelectedMcpItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.resourceId,
      {
        value: formatOverrideEditorValue(item.configOverride),
        error: null
      }
    ])
  );
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

  useEffect(() => {
    if (!id) {
      void navigate('/profiles', { replace: true });
    }
  }, [id, navigate]);

  const [
    profileDetailQuery,
    skillsQuery,
    mcpsQuery,
    rulesQuery
  ] = useQueries({
    queries: [
      {
        queryKey: id ? queryKeys.profiles.detail(id) : queryKeys.profiles.list(),
        queryFn: () => getProfile(id!),
        enabled: Boolean(id)
      },
      {
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills')
      },
      {
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps')
      },
      {
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules')
      }
    ]
  });

  useEffect(() => {
    const queryError =
      profileDetailQuery.error ??
      skillsQuery.error ??
      mcpsQuery.error ??
      rulesQuery.error;

    if (!queryError) {
      return;
    }

    handleError(queryError);
    void navigate('/profiles');
  }, [
    handleError,
    mcpsQuery.error,
    navigate,
    profileDetailQuery.error,
    rulesQuery.error,
    skillsQuery.error
  ]);

  const catalog = useMemo(
    () =>
      skillsQuery.data && mcpsQuery.data && rulesQuery.data
        ? {
            skills: skillsQuery.data,
            mcps: mcpsQuery.data,
            rules: rulesQuery.data
          }
        : null,
    [mcpsQuery.data, rulesQuery.data, skillsQuery.data]
  );
  const loading =
    profileDetailQuery.isPending ||
    skillsQuery.isPending ||
    mcpsQuery.isPending ||
    rulesQuery.isPending;

  if (!id) {
    return null;
  }

  if (loading || !profileDetailQuery.data || !catalog) {
    return <Card className="page-card" loading />;
  }

  return (
    <ProfileEditorContent
      key={`${profileDetailQuery.data.id}:${profileDetailQuery.data.updatedAt}`}
      profileId={id}
      initialDetail={profileDetailQuery.data}
      catalog={catalog}
      onBack={() => {
        void navigate('/profiles');
      }}
    />
  );
}

function ProfileEditorContent({
  profileId,
  initialDetail,
  catalog,
  onBack
}: {
  profileId: string;
  initialDetail: ProfileDetail;
  catalog: ResourceCatalog;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const [form] = Form.useForm<ProfileEditorFormValues>();
  const [selectedSkills, setSelectedSkills] = useState<SelectedBaseItem[]>(() =>
    toSelectedBaseItems(initialDetail.skills)
  );
  const [selectedMcps, setSelectedMcps] = useState<SelectedMcpItem[]>(() =>
    toSelectedMcpItems(initialDetail.mcps)
  );
  const [selectedRules, setSelectedRules] = useState<SelectedBaseItem[]>(() =>
    toSelectedBaseItems(initialDetail.rules)
  );
  const [expandedMcps, setExpandedMcps] = useState<string[]>([]);
  const [mcpEditorState, setMcpEditorState] = useState<
    Record<string, OverrideEditorState>
  >(() => buildMcpEditorState(toSelectedMcpItems(initialDetail.mcps)));
  const [searchState, setSearchState] = useState<SearchState>({
    skills: '',
    mcps: '',
    rules: ''
  });

  const deferredSkillSearch = useDeferredValue(searchState.skills);
  const deferredMcpSearch = useDeferredValue(searchState.mcps);
  const deferredRuleSearch = useDeferredValue(searchState.rules);
  const initialValues = useMemo(
    () => ({
      name: initialDetail.name,
      description: initialDetail.description ?? ''
    }),
    [initialDetail.description, initialDetail.name]
  );

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      profile: ProfilePayload;
      items: ProfileItemsPayload;
    }) => {
      await updateProfile(profileId, payload.profile);
      return replaceProfileItems(profileId, payload.items);
    },
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.profiles.detail(profileId), detail);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
      void message.success('Profile saved');
    }
  });

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
      filterAvailableResources(
        catalog.rules,
        selectedRuleIds,
        deferredRuleSearch
      ),
    [catalog.rules, deferredRuleSearch, selectedRuleIds]
  );

  const updateSearchValue = useCallback(
    (key: keyof SearchState, value: string) => {
      setSearchState((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const addBaseResource = useCallback(
    (
      resourceId: string,
      resources: Array<{ id: string; name: string; description: string | null }>,
      selectedIds: Set<string>,
      setItems: React.Dispatch<React.SetStateAction<SelectedBaseItem[]>>
    ) => {
      const resource = resources.find((item) => item.id === resourceId);
      if (!resource || selectedIds.has(resourceId)) {
        return;
      }

      setItems((current) =>
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
    },
    []
  );

  const addSkill = useCallback(
    (resourceId: string) => {
      addBaseResource(resourceId, catalog.skills, selectedSkillIds, setSelectedSkills);
    },
    [addBaseResource, catalog.skills, selectedSkillIds]
  );

  const addRule = useCallback(
    (resourceId: string) => {
      addBaseResource(resourceId, catalog.rules, selectedRuleIds, setSelectedRules);
    },
    [addBaseResource, catalog.rules, selectedRuleIds]
  );

  const addMcp = useCallback((resourceId: string) => {
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
  }, [catalog.mcps, selectedMcpIds]);

  const updateMcpOverride = useCallback((resourceId: string, value: string) => {
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
  }, []);

  const removeSkill = useCallback((resourceId: string) => {
    setSelectedSkills((current) => removeSelectedItem(current, resourceId));
  }, []);

  const removeRule = useCallback((resourceId: string) => {
    setSelectedRules((current) => removeSelectedItem(current, resourceId));
  }, []);

  const removeMcp = useCallback((resourceId: string) => {
    setSelectedMcps((current) => removeSelectedItem(current, resourceId));
    setExpandedMcps((current) => current.filter((item) => item !== resourceId));
    setMcpEditorState((current) => {
      const next = { ...current };
      delete next[resourceId];
      return next;
    });
  }, []);

  const reorderSkills = useCallback((activeId: string, overId: string) => {
    setSelectedSkills((current) =>
      reorderSelectedItems(current, activeId, overId)
    );
  }, []);

  const reorderMcps = useCallback((activeId: string, overId: string) => {
    setSelectedMcps((current) => reorderSelectedItems(current, activeId, overId));
  }, []);

  const reorderRules = useCallback((activeId: string, overId: string) => {
    setSelectedRules((current) =>
      reorderSelectedItems(current, activeId, overId)
    );
  }, []);

  const baseSections = useMemo<BaseSectionConfig[]>(
    () => [
      {
        key: 'skills',
        title: 'Skills',
        emptyAvailableText: '没有可添加的 Skill',
        emptySelectedText: '还没有选中的 Skill',
        searchValue: searchState.skills,
        onSearchChange: (value) => updateSearchValue('skills', value),
        availableItems: toAvailableItems(availableSkills),
        selectedItems: selectedSkills,
        onAdd: addSkill,
        onRemove: removeSkill,
        onReorder: reorderSkills
      },
      {
        key: 'rules',
        title: 'Rules',
        emptyAvailableText: '没有可添加的 Rule',
        emptySelectedText: '还没有选中的 Rule',
        searchValue: searchState.rules,
        onSearchChange: (value) => updateSearchValue('rules', value),
        availableItems: toAvailableItems(availableRules),
        selectedItems: selectedRules,
        onAdd: addRule,
        onRemove: removeRule,
        onReorder: reorderRules
      }
    ],
    [
      addRule,
      addSkill,
      availableRules,
      availableSkills,
      removeRule,
      removeSkill,
      reorderRules,
      reorderSkills,
      searchState.rules,
      searchState.skills,
      selectedRules,
      selectedSkills,
      updateSearchValue
    ]
  );

  const mcpSection = useMemo<McpSectionConfig>(
    () => ({
      key: 'mcps',
      title: 'MCPs',
      emptyAvailableText: '没有可添加的 MCP',
      emptySelectedText: '还没有选中的 MCP',
      searchValue: searchState.mcps,
      onSearchChange: (value) => updateSearchValue('mcps', value),
      availableItems: toAvailableItems(availableMcps, (item) => item.content.command),
      selectedItems: selectedMcps,
      onAdd: addMcp,
      onRemove: removeMcp,
      onReorder: reorderMcps
    }),
    [
      addMcp,
      availableMcps,
      removeMcp,
      reorderMcps,
      searchState.mcps,
      selectedMcps,
      updateSearchValue
    ]
  );

  const saveProfile = async () => {
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

    try {
      await saveMutation.mutateAsync({
        profile: profilePayload,
        items: itemsPayload
      });
    } catch (error) {
      handleError(error);
    }
  };
  const saving = saveMutation.isPending;

  return (
    <Card className="page-card">
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
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Back</Button>
          <Button type="primary" loading={saving} onClick={() => void saveProfile()}>
            Save
          </Button>
        </Space>
      </div>

      <Form<ProfileEditorFormValues>
        layout="vertical"
        form={form}
        initialValues={initialValues}
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
        {baseSections
          .filter((section) => section.key === 'skills')
          .map((section) => (
            <Card key={section.key} className="profile-editor__section-card">
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
                  items={section.selectedItems}
                  onRemove={section.onRemove}
                  onReorder={section.onReorder}
                />
              </div>
            </Card>
          ))}

        <Card className="profile-editor__section-card">
          <Typography.Title level={3}>{mcpSection.title}</Typography.Title>
          <div className="profile-editor__section-grid">
            <AvailableResourceList
              title="可选资源"
              searchValue={mcpSection.searchValue}
              onSearchChange={mcpSection.onSearchChange}
              items={mcpSection.availableItems}
              emptyText={mcpSection.emptyAvailableText}
              onAdd={mcpSection.onAdd}
            />
            <SelectedResourceList
              title="已选资源"
              emptyText={mcpSection.emptySelectedText}
              items={mcpSection.selectedItems}
              onRemove={mcpSection.onRemove}
              onReorder={mcpSection.onReorder}
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

        {baseSections
          .filter((section) => section.key === 'rules')
          .map((section) => (
            <Card key={section.key} className="profile-editor__section-card">
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
                  items={section.selectedItems}
                  onRemove={section.onRemove}
                  onReorder={section.onReorder}
                />
              </div>
            </Card>
          ))}
      </div>
    </Card>
  );
}
