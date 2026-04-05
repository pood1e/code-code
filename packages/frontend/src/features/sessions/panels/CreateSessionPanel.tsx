import type {
  AgentRunnerSummary,
  ChatSummary,
  Profile,
  ResourceByKind,
  RunnerTypeResponse
} from '@agent-workbench/shared';

import { CreateSessionAdvancedSettings } from './CreateSessionAdvancedSettings';
import { CreateSessionComposer } from './CreateSessionComposer';
import { CreateSessionSetupBar } from './CreateSessionSetupBar';
import { useCreateSessionPanelState } from './use-create-session-panel-state';

export function CreateSessionPanel({
  projectId,
  runnerTypes,
  runners,
  profiles,
  resources,
  canCancel,
  onCancel,
  onCreated
}: {
  projectId: string;
  runnerTypes: RunnerTypeResponse[];
  runners: AgentRunnerSummary[];
  profiles: Profile[];
  resources: {
    skills: ResourceByKind['skills'][];
    mcps: ResourceByKind['mcps'][];
    rules: ResourceByKind['rules'][];
  };
  canCancel: boolean;
  onCancel: () => void;
  onCreated: (chat: ChatSummary) => void;
}) {
  const {
    form,
    submitError,
    selectedRunnerId,
    selectedProfileId,
    selectedWorkspaceResources,
    selectedSkillIds,
    selectedRuleIds,
    selectedMcpIds,
    sessionConfigSchema,
    runtimeFields,
    additionalInputFields,
    supportsStructuredInitialInput,
    hasInitialMessageDraft,
    runnerContext,
    isCreating,
    toggleSelection,
    submit,
    handlePromptKeyDown
  } = useCreateSessionPanelState({
    projectId,
    runnerTypes,
    runners,
    onCreated
  });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-2 py-2 sm:px-4 sm:py-4">
        <CreateSessionSetupBar
          form={form}
          runners={runners}
          profiles={profiles}
          selectedRunnerId={selectedRunnerId}
          selectedProfileId={selectedProfileId}
          sessionConfigFields={
            sessionConfigSchema.supported ? sessionConfigSchema.fields : []
          }
          runnerContext={runnerContext}
        />

        <CreateSessionAdvancedSettings
          control={form.control}
          resources={resources}
          selectedWorkspaceResources={selectedWorkspaceResources}
          selectedSkillIds={selectedSkillIds}
          selectedRuleIds={selectedRuleIds}
          selectedMcpIds={selectedMcpIds}
          onToggleSelection={toggleSelection}
        />

        <CreateSessionComposer
          form={form}
          runtimeFields={runtimeFields}
          additionalInputFields={additionalInputFields}
          runnerContext={runnerContext}
          supportsStructuredInitialInput={supportsStructuredInitialInput}
          hasInitialMessageDraft={hasInitialMessageDraft}
          submitError={submitError}
          canCancel={canCancel}
          isCreating={isCreating}
          onCancel={onCancel}
          onSubmit={() => void submit()}
          onPromptKeyDown={handlePromptKeyDown}
        />
      </div>
    </div>
  );
}
