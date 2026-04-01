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
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  message
} from 'antd';
import {
  type ProfileDetail,
  type ProfileItemsPayload
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
import { ResourceSectionCard } from './profile-editor.components';
import {
  buildMcpEditorState,
  buildProfileItemsPayload,
  buildProfilePayload,
  filterAvailableResources,
  parseOverrideEditorValue,
  removeSelectedItem,
  reorderSelectedItems,
  syncOrders,
  toAvailableItems,
  toSelectedBaseItems,
  toSelectedMcpItems,
  type BaseSectionConfig,
  type McpSectionConfig,
  type OverrideEditorState,
  type ProfileEditorFormValues,
  type ResourceCatalog,
  type SearchState,
  type SelectedBaseItem,
  type SelectedMcpItem
} from './profile-editor.utils';

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
  const skillSection = baseSections.find((section) => section.key === 'skills');
  const ruleSection = baseSections.find((section) => section.key === 'rules');

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
        {skillSection ? (
          <ResourceSectionCard<SelectedBaseItem> section={skillSection} />
        ) : null}

        <ResourceSectionCard<SelectedMcpItem>
          section={mcpSection}
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

        {ruleSection ? (
          <ResourceSectionCard<SelectedBaseItem> section={ruleSection} />
        ) : null}
      </div>
    </Card>
  );
}
