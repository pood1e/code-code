import type { RunnerTypeResponse } from '@agent-workbench/shared';

import { EditorToolbar } from '@/components/app/EditorToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { agentRunnerConfig } from '@/types/agent-runners';

import type { AgentRunnerEditorFormValues } from './agent-runner.form';
import {
  AgentRunnerBasicsSection,
  AgentRunnerConfigSection
} from './agent-runner-editor.components';
import { useAgentRunnerEditorForm } from './use-agent-runner-editor-form';

export function AgentRunnerEditorContent({
  initialValues,
  onBack,
  runnerId,
  runnerTypes
}: {
  initialValues: AgentRunnerEditorFormValues;
  onBack: () => void;
  runnerId?: string;
  runnerTypes: RunnerTypeResponse[];
}) {
  const {
    form,
    handleRawRunnerConfigChange,
    handleSave,
    handleTypeChange,
    isEditing,
    parsedSchema,
    rawRunnerConfigError,
    rawRunnerConfigText,
    saveDisabled,
    selectedRunnerType,
    selectedTypeId,
    submitError
  } = useAgentRunnerEditorForm({
    initialValues,
    runnerId,
    runnerTypes
  });

  return (
    <div className="space-y-4">
      <EditorToolbar
        title={`${isEditing ? '编辑' : '新建'} ${agentRunnerConfig.singularLabel}`}
        onBack={onBack}
        onSave={() => void handleSave()}
        saveDisabled={saveDisabled}
      />

      {submitError ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <AgentRunnerBasicsSection
          descriptionError={form.formState.errors.description?.message}
          isEditing={isEditing}
          nameError={form.formState.errors.name?.message}
          onTypeChange={handleTypeChange}
          register={form.register}
          runnerTypes={runnerTypes}
          selectedRunnerType={selectedRunnerType}
          selectedTypeId={selectedTypeId ?? ''}
          typeError={form.formState.errors.type?.message}
        />

        <AgentRunnerConfigSection
          control={form.control}
          onRawRunnerConfigChange={handleRawRunnerConfigChange}
          parsedSchema={parsedSchema}
          rawRunnerConfigError={rawRunnerConfigError}
          rawRunnerConfigText={rawRunnerConfigText}
        />
      </form>
    </div>
  );
}
