import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type ProfileDetail,
  type SaveProfileInput
} from '@agent-workbench/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useErrorMessage } from '@/hooks/use-error-message';
import { saveProfile } from '@/api/profiles';
import { EditorToolbar } from '@/components/app/EditorToolbar';
import { queryKeys } from '@/query/query-keys';

import {
  McpOverrideEditorCard,
  ProfileSummaryCard,
  ResourceSectionCard
} from './profile-editor.components';
import {
  buildSaveProfileInput,
  profileEditorFormSchema,
  type ProfileEditorFormValues,
  type ResourceCatalog,
  type SelectedBaseItem,
  type SelectedMcpItem
} from './profile-editor.form';
import { useProfileEditorResources } from './use-profile-editor-resources';

export function ProfileEditorContent({
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
  const {
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
  } = useProfileEditorResources({
    catalog,
    initialDetail
  });

  const saveMutation = useMutation<ProfileDetail, Error, SaveProfileInput>({
    mutationFn: (payload) => saveProfile(profileId, payload),
    onSuccess: async (detail) => {
      queryClient.setQueryData(queryKeys.profiles.detail(profileId), detail);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.list()
      });
      toast.success('Profile 已保存');
      onBack();
    }
  });

  const handleSaveProfile = form.handleSubmit(async (values) => {
    const invalidOverride = Object.values(mcpEditorState).find(
      (item) => item.error
    );
    if (invalidOverride) {
      toast.error('请先修正 MCP override 的 JSON。');
      return;
    }

    try {
      await saveMutation.mutateAsync(
        buildSaveProfileInput(
          values,
          selectedSkills,
          selectedMcps,
          selectedRules
        )
      );
    } catch (error) {
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

      <ProfileSummaryCard
        nameInputId="profile-name"
        descriptionInputId="profile-description"
        nameError={form.formState.errors.name?.message}
        descriptionError={form.formState.errors.description?.message}
        formRegister={{
          name: form.register('name'),
          description: form.register('description')
        }}
      />

      <ResourceSectionCard<SelectedBaseItem> section={skillSection} />

      <ResourceSectionCard<SelectedMcpItem>
        section={mcpSection}
        renderMeta={(item) => item.command}
        renderDetails={(item) => {
          return (
            <McpOverrideEditorCard
              expanded={expandedMcps.includes(item.resourceId)}
              editorState={
                mcpEditorState[item.resourceId] ?? {
                  value: '',
                  error: null
                }
              }
              onToggleExpanded={() =>
                toggleMcpOverride(item.resourceId)
              }
              onChange={(value) => updateMcpOverride(item.resourceId, value)}
            />
          );
        }}
      />

      <ResourceSectionCard<SelectedBaseItem> section={ruleSection} />
    </div>
  );
}
