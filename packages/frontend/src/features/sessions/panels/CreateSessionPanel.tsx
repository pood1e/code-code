import type {
  AgentRunnerSummary,
  Profile,
  ResourceByKind,
  RunnerTypeResponse,
  SessionDetail
} from '@agent-workbench/shared';

import { CreateSessionAdvancedSettings } from './CreateSessionAdvancedSettings';
import { CreateSessionComposer } from './CreateSessionComposer';
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
  onCreated: (session: SessionDetail) => void;
}) {
  const {
    form,
    advancedOpen,
    submitError,
    selectedRunnerId,
    selectedProfileId,
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
    setAdvancedOpen,
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
    <div className="flex min-h-[36rem] flex-col xl:min-h-[calc(100vh-14rem)]">
      <CreateSessionComposer
        form={form}
        runners={runners}
        profiles={profiles}
        selectedRunnerId={selectedRunnerId}
        selectedProfileId={selectedProfileId}
        supportsStructuredInitialInput={supportsStructuredInitialInput}
        hasInitialMessageDraft={hasInitialMessageDraft}
        advancedOpen={advancedOpen}
        submitError={submitError}
        canCancel={canCancel}
        isCreating={isCreating}
        onToggleAdvanced={() => setAdvancedOpen(!advancedOpen)}
        onCancel={onCancel}
        onSubmit={() => void submit()}
        onPromptKeyDown={handlePromptKeyDown}
      />

      <CreateSessionAdvancedSettings
        open={advancedOpen}
        control={form.control}
        additionalInputFields={additionalInputFields}
        sessionConfigFields={
          sessionConfigSchema.supported ? sessionConfigSchema.fields : []
        }
        runtimeFields={runtimeFields}
        runnerContext={runnerContext}
        resources={resources}
        selectedSkillIds={selectedSkillIds}
        selectedRuleIds={selectedRuleIds}
        selectedMcpIds={selectedMcpIds}
        onToggleSelection={toggleSelection}
      />
    </div>
  );
}
