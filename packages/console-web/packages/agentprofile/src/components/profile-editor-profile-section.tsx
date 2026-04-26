import { FormSelectField, FormTextField, RuntimeSelectionFields } from "@code-code/console-web-ui";
import { ProfileEditorSectionCard } from "./profile-editor-section-card";
import { sessionRuntimeExecutionClassSelectItems, sessionRuntimeProviderSelectItems } from "../domain/profile-adapters";
import type { AgentProfileDraft, CLIReference, SessionRuntimeOptions } from "../domain/types";

type Props = {
  draft: AgentProfileDraft;
  isCreating: boolean;
  clis: CLIReference[];
  sessionRuntimeOptions: SessionRuntimeOptions;
  onChangeName: (value: string) => void;
  onChangeCLI: (value: string) => void;
  onChangeExecutionClass: (value: string) => void;
};

export function ProfileEditorProfileSection({
  draft,
  isCreating,
  clis,
  sessionRuntimeOptions,
  onChangeName,
  onChangeCLI,
  onChangeExecutionClass,
}: Props) {
  return (
    <ProfileEditorSectionCard title="Profile">
      <FormTextField label="Name" value={draft.name} onValueChange={onChangeName} />

      <RuntimeSelectionFields
        providerField={(
          <FormSelectField
            label="CLI"
            style={{ flex: 1 }}
            value={draft.selectionStrategy.cliId}
            disabled={!isCreating}
            items={sessionRuntimeProviderSelectItems(sessionRuntimeOptions, draft.selectionStrategy.cliId, clis)}
            onValueChange={onChangeCLI}
          />
        )}
        executionClass={draft.selectionStrategy.executionClass}
        executionClassItems={sessionRuntimeExecutionClassSelectItems(
          sessionRuntimeOptions,
          draft.selectionStrategy.cliId,
          draft.selectionStrategy.executionClass,
        )}
        executionClassDisabled={!isCreating}
        onExecutionClassChange={onChangeExecutionClass}
      />
    </ProfileEditorSectionCard>
  );
}
