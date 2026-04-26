import { Dialog, Flex } from "@radix-ui/themes";
import { AsyncState, DialogSaveFooterActions, FormFieldError, NoDataCallout, requestErrorMessage } from "@code-code/console-web-ui";
import { useEffect, useMemo, useState } from "react";
import { FallbackPickerDialog } from "./fallback-picker-dialog";
import { ProfileEditorFallbackSection } from "./profile-editor-fallback-section";
import { ProfileEditorProfileSection } from "./profile-editor-profile-section";
import { ProfileEditorResourcesSection } from "./profile-editor-resources-section";
import { cloneDraft, createDraftProfile } from "../domain/profile-adapters";
import {
  appendDraftFallback,
  attachDraftResourceID,
  detachDraftResourceID,
  moveDraftFallback,
  readAvailableResources,
  readFallbackProviderOptions,
  readSelectedResources,
  readSupportedProviderTypesLabel,
  removeDraftFallback,
  sanitizeProfileDraftResources,
  updateDraftCLI,
  validateProfileDraft,
} from "../domain/profile-editor-model";
import type { AgentProfileDraft, CLIReference, MCPResourceSummary, TextResourceSummary } from "../domain/types";
import type { SessionRuntimeOptions } from "../domain/types";
import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";

type ProfileEditorDialogProps = {
  open: boolean;
  profile: AgentProfileDraft | null;
  isLoading?: boolean;
  clis: CLIReference[];
  sessionRuntimeOptions: SessionRuntimeOptions;
  providerSurfaces: ProviderSurfaceBindingView[];
  vendors: VendorView[];
  mcps: MCPResourceSummary[];
  skills: TextResourceSummary[];
  rules: TextResourceSummary[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: AgentProfileDraft) => Promise<void>;
};

export function ProfileEditorDialog({
  open,
  profile,
  isLoading = false,
  clis,
  sessionRuntimeOptions,
  providerSurfaces,
  vendors,
  mcps,
  skills,
  rules,
  onOpenChange,
  onSubmit
}: ProfileEditorDialogProps) {
  const [draft, setDraft] = useState(createDraftProfile(sessionRuntimeOptions));
  const [fallbackPickerOpen, setFallbackPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isCreating = profile === null;

  useEffect(() => {
    if (!open) {
      setFallbackPickerOpen(false);
      setSubmitError(null);
      setIsSubmitting(false);
      return;
    }
    setDraft(profile ? cloneDraft(profile) : createDraftProfile(sessionRuntimeOptions));
    setSubmitError(null);
  }, [open, profile]);

  useEffect(() => {
    if (!open || !isCreating) {
      return;
    }
    setDraft((current) => {
      if (current.selectionStrategy.cliId) {
        return current;
      }
      const defaults = createDraftProfile(sessionRuntimeOptions);
      return {
        ...current,
        selectionStrategy: defaults.selectionStrategy,
      };
    });
  }, [isCreating, open, sessionRuntimeOptions]);

  const selectedMcps = useMemo(() => readSelectedResources(mcps, draft.mcpIds), [draft.mcpIds, mcps]);
  const selectedSkills = useMemo(() => readSelectedResources(skills, draft.skillIds), [draft.skillIds, skills]);
  const selectedRules = useMemo(() => readSelectedResources(rules, draft.ruleIds), [draft.ruleIds, rules]);
  const availableMcps = useMemo(() => readAvailableResources(mcps, draft.mcpIds), [draft.mcpIds, mcps]);
  const availableSkills = useMemo(() => readAvailableResources(skills, draft.skillIds), [draft.skillIds, skills]);
  const availableRules = useMemo(() => readAvailableResources(rules, draft.ruleIds), [draft.ruleIds, rules]);
  const fallbackProviders = useMemo(
    () => readFallbackProviderOptions(providerSurfaces, vendors, clis, draft),
    [clis, draft, providerSurfaces, vendors],
  );
  const supportedTypes = useMemo(
    () => readSupportedProviderTypesLabel(draft.selectionStrategy.cliId, clis),
    [clis, draft.selectionStrategy.cliId],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="860px">
        <Dialog.Title>{profile ? `Edit ${draft.name}` : "New Profile"}</Dialog.Title>

        <AsyncState
          loading={isLoading && !isCreating}
          loadingContent={
            <NoDataCallout size="2" mt="4">
              Loading profile...
            </NoDataCallout>
          }
        >
          <Flex direction="column" gap="4" mt="4">
            <ProfileEditorProfileSection
              draft={draft}
              isCreating={isCreating}
              clis={clis}
              sessionRuntimeOptions={sessionRuntimeOptions}
              onChangeName={(value) => setDraft((current) => ({ ...current, name: value }))}
              onChangeCLI={(value) => setDraft((current) => updateDraftCLI(current, value, sessionRuntimeOptions))}
              onChangeExecutionClass={(value) =>
                setDraft((current) => ({ ...current, selectionStrategy: { ...current.selectionStrategy, executionClass: value } }))
              }
            />

            <ProfileEditorFallbackSection
              supportedTypesLabel={supportedTypes}
              fallbackProvidersCount={fallbackProviders.length}
              fallbackChain={draft.selectionStrategy.fallbackChain}
              onOpenPicker={() => setFallbackPickerOpen(true)}
              onMoveUp={(index) => setDraft((current) => moveDraftFallback(current, index, index - 1))}
              onMoveDown={(index) => setDraft((current) => moveDraftFallback(current, index, index + 1))}
              onRemove={(index) => setDraft((current) => removeDraftFallback(current, index))}
            />

            <ProfileEditorResourcesSection
              selectedMcps={selectedMcps}
              selectedSkills={selectedSkills}
              selectedRules={selectedRules}
              availableMcps={availableMcps}
              availableSkills={availableSkills}
              availableRules={availableRules}
              onAttachMCP={(id) => setDraft((current) => attachDraftResourceID(current, "mcpIds", id))}
              onRemoveMCP={(id) => setDraft((current) => detachDraftResourceID(current, "mcpIds", id))}
              onAttachSkill={(id) => setDraft((current) => attachDraftResourceID(current, "skillIds", id))}
              onRemoveSkill={(id) => setDraft((current) => detachDraftResourceID(current, "skillIds", id))}
              onAttachRule={(id) => setDraft((current) => attachDraftResourceID(current, "ruleIds", id))}
              onRemoveRule={(id) => setDraft((current) => detachDraftResourceID(current, "ruleIds", id))}
            />

            <FormFieldError>{submitError}</FormFieldError>

            <DialogSaveFooterActions
              isSubmitting={isSubmitting}
              onSubmit={async () => {
                const draftError = validateProfileDraft(draft);
                if (draftError) {
                  setSubmitError(draftError);
                  return;
                }
                setIsSubmitting(true);
                setSubmitError(null);
                try {
                  await onSubmit(sanitizeProfileDraftResources(draft, mcps, skills, rules));
                  onOpenChange(false);
                } catch (error) {
                  setSubmitError(requestErrorMessage(error, "Failed to save profile"));
                } finally {
                  setIsSubmitting(false);
                }
              }}
            />
          </Flex>
        </AsyncState>
      </Dialog.Content>

      <FallbackPickerDialog
        open={fallbackPickerOpen}
        items={fallbackProviders}
        onOpenChange={setFallbackPickerOpen}
        onSelect={(item) => setDraft((current) => appendDraftFallback(current, item))}
      />
    </Dialog.Root>
  );
}
