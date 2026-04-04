import {
  useDeferredValue,
  useMemo,
  useState
} from 'react';
import type { ProfileDetail } from '@agent-workbench/shared';

import {
  toSelectedBaseItems,
  type ResourceCatalog,
  type SearchState,
  type SelectedBaseItem
} from './profile-editor.form';
import { buildBaseSectionConfig } from './profile-base-sections';
import { useMcpSectionState } from './profile-mcp-section';

export function useProfileEditorResources({
  catalog,
  initialDetail
}: {
  catalog: ResourceCatalog;
  initialDetail: ProfileDetail;
}) {
  const [selectedSkills, setSelectedSkills] = useState<SelectedBaseItem[]>(() =>
    toSelectedBaseItems(initialDetail.skills)
  );
  const [selectedRules, setSelectedRules] = useState<SelectedBaseItem[]>(() =>
    toSelectedBaseItems(initialDetail.rules)
  );
  const [searchState, setSearchState] = useState<SearchState>({
    skills: '',
    mcps: '',
    rules: ''
  });

  const deferredSkillSearch = useDeferredValue(searchState.skills);
  const deferredRuleSearch = useDeferredValue(searchState.rules);
  const selectedSkillIds = useSelectedResourceIds(selectedSkills);
  const selectedRuleIds = useSelectedResourceIds(selectedRules);
  const {
    selectedMcps,
    mcpSection,
    expandedMcps,
    mcpEditorState,
    toggleMcpOverride,
    updateMcpOverride
  } = useMcpSectionState({
    catalog: catalog.mcps,
    initialMcps: initialDetail.mcps,
    searchState,
    setSearchState
  });

  const skillSection = useMemo(
    () =>
      buildBaseSectionConfig({
        key: 'skills',
        title: 'Skills',
        emptyAvailableText: '没有可添加的 Skill',
        emptySelectedText: '还没有选中的 Skill',
        searchValue: searchState.skills,
        deferredSearchValue: deferredSkillSearch,
        catalogItems: catalog.skills,
        selectedIds: selectedSkillIds,
        selectedItems: selectedSkills,
        setSearchState,
        setSelectedItems: setSelectedSkills
      }),
    [
      catalog.skills,
      deferredSkillSearch,
      searchState.skills,
      selectedSkillIds,
      selectedSkills
    ]
  );

  const ruleSection = useMemo(
    () =>
      buildBaseSectionConfig({
        key: 'rules',
        title: 'Rules',
        emptyAvailableText: '没有可添加的 Rule',
        emptySelectedText: '还没有选中的 Rule',
        searchValue: searchState.rules,
        deferredSearchValue: deferredRuleSearch,
        catalogItems: catalog.rules,
        selectedIds: selectedRuleIds,
        selectedItems: selectedRules,
        setSearchState,
        setSelectedItems: setSelectedRules
      }),
    [
      catalog.rules,
      deferredRuleSearch,
      searchState.rules,
      selectedRuleIds,
      selectedRules
    ]
  );

  return {
    selectedSkills,
    selectedMcps,
    selectedRules,
    skillSection,
    mcpSection,
    ruleSection,
    expandedMcps,
    mcpEditorState,
    toggleMcpOverride,
    updateMcpOverride
  };
}

function useSelectedResourceIds(items: Array<{ resourceId: string }>) {
  return useMemo(
    () => new Set(items.map((item) => item.resourceId)),
    [items]
  );
}
