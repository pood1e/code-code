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
  type ProfileDetail,
  type SaveProfileInput
} from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  isNotFoundApiError,
  useErrorMessage
} from '@/api/client';
import {
  getProfile,
  saveProfile
} from '@/api/profiles';
import { listResources } from '@/api/resources';
import { EditorToolbar } from '@/components/app/EditorToolbar';
import { FormField } from '@/components/app/FormField';
import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { CodeEditor } from '@/components/JsonEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/query/query-keys';
import { ResourceSectionCard } from './profile-editor.components';
import {
  buildMcpEditorState,
  buildSaveProfileInput,
  filterAvailableResources,
  parseOverrideEditorValue,
  profileEditorFormSchema,
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

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40 rounded-xl" />
      <Skeleton className="h-28 rounded-[calc(var(--radius)*1.2)]" />
      <Skeleton className="h-80 rounded-[calc(var(--radius)*1.2)]" />
      <Skeleton className="h-80 rounded-[calc(var(--radius)*1.2)]" />
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
  const profileNotFound = isNotFoundApiError(profileDetailQuery.error);

  useEffect(() => {
    const queryError =
      skillsQuery.error ??
      mcpsQuery.error ??
      rulesQuery.error ??
      (profileNotFound ? null : profileDetailQuery.error);

    if (!queryError) {
      return;
    }

    handleError(queryError);
    void navigate('/profiles', { replace: true });
  }, [
    handleError,
    mcpsQuery.error,
    navigate,
    profileNotFound,
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

  if (profileNotFound) {
    return (
      <EmptyState
        title="未找到 Profile"
        description="当前 Profile 不存在或已被删除。"
        action={
          <Button variant="outline" onClick={() => void navigate('/profiles')}>
            <ArrowLeft data-icon="inline-start" />
            返回 Profiles
          </Button>
        }
      />
    );
  }

  if (loading || !profileDetailQuery.data || !catalog) {
    return <LoadingState />;
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
  const form = useForm<ProfileEditorFormValues>({
    resolver: zodResolver(profileEditorFormSchema),
    defaultValues: {
      name: initialDetail.name,
      description: initialDetail.description ?? ''
    }
  });
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

  const saveMutation = useMutation<ProfileDetail, Error, SaveProfileInput>({
    mutationFn: (payload) => saveProfile(profileId, payload),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.profiles.detail(profileId), detail);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
      toast.success('Profile 已保存');
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

  const handleSaveProfile = form.handleSubmit(async (values) => {
    const invalidOverride = Object.values(mcpEditorState).find(
      (item) => item.error
    );
    if (invalidOverride) {
      toast.error('请先修正 MCP override 的 JSON。');
      return;
    }

    try {
      const payload = buildSaveProfileInput(
        values,
        selectedSkills,
        selectedMcps,
        selectedRules
      );

      await saveMutation.mutateAsync(payload);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      handleError(error);
    }
  });

  return (
    <div className="space-y-6">
      <EditorToolbar
        title={initialDetail.name}
        onBack={onBack}
        onSave={() => void handleSaveProfile()}
        saveDisabled={saveMutation.isPending}
      />

      <SurfaceCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField
            label="Name"
            htmlFor="profile-name"
            error={form.formState.errors.name?.message}
          >
            <Input id="profile-name" {...form.register('name')} />
          </FormField>
          <FormField
            label="Description"
            htmlFor="profile-description"
            error={form.formState.errors.description?.message}
          >
            <Textarea
              id="profile-description"
              rows={4}
              {...form.register('description')}
            />
          </FormField>
        </div>
      </SurfaceCard>

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
            <div className="space-y-3 rounded-[calc(var(--radius)*1.05)] border border-border/70 bg-muted/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">MCP Override</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
              </div>
              {isExpanded ? (
                <div className="space-y-3">
                  <CodeEditor
                    value={editor.value}
                    onChange={(value) =>
                      updateMcpOverride(item.resourceId, value)
                    }
                  />
                  {editor.error ? (
                    <p className="text-sm text-destructive">{editor.error}</p>
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
  );
}
