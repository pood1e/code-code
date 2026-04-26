import { Button, Flex, SegmentedControl } from "@radix-ui/themes";
import type { AgentProfileListItem } from "@code-code/agent-contract/platform/management/v1";
import { ChatInlineRuntimeEditor } from "./chat-inline-runtime-editor";
import type { SessionRuntimeOptions } from "../session-runtime-options";
import type { ChatInlineSetup, ChatMode } from "../types";
import { FormField, FormSelectField } from "@code-code/console-web-ui";

export type SessionSetupPanelState = {
  mode: ChatMode;
  modeLocked: boolean;
  setupDirty: boolean;
  currentModelId?: string;
  profileId: string;
  inlineImportProfileId: string;
  inlineDraft: ChatInlineSetup | null;
  inlineRuntimeOpen: boolean;
  profiles: AgentProfileListItem[];
  profilesLoading: boolean;
  runtimeOptions: SessionRuntimeOptions;
  runtimeOptionsLoading: boolean;
  busy: boolean;
};

export type SessionSetupPanelActions = {
  onModeChange: (value: ChatMode) => void;
  onProfileIdChange: (value: string) => void;
  onInlineImportProfileIdChange: (value: string) => void;
  onImportInlineProfile: () => void;
  onProviderIdChange: (value: string) => void;
  onExecutionClassChange: (value: string) => void;
  onInlineRuntimeOpenChange: (open: boolean) => void;
  onPrimarySurfaceChange: (surfaceId: string) => void;
  onPrimaryModelChange: (modelId: string) => void;
  onFallbackAdd: () => void;
  onFallbackRemove: (index: number) => void;
  onFallbackSurfaceChange: (index: number, surfaceId: string) => void;
  onFallbackModelChange: (index: number, modelId: string) => void;
};

type SessionSetupPanelProps = {
  state: SessionSetupPanelState;
  actions: SessionSetupPanelActions;
};

export function SessionSetupPanel({ state, actions }: SessionSetupPanelProps) {
  const profileItems = state.profiles.map((item) => ({ value: item.profileId, label: item.name || item.profileId }));

  return (
    <Flex direction="column" gap="4">

      <FormField label="Mode" className="chatField" labelClassName="chatFieldLabel">
        <SegmentedControl.Root
          className="chatModeSwitch"
          value={state.mode}
          disabled={state.modeLocked}
          onValueChange={(value) => actions.onModeChange(value as ChatMode)}
        >
          <SegmentedControl.Item className="chatModeSwitchItem" value="profile">
            Profile
          </SegmentedControl.Item>
          <SegmentedControl.Item className="chatModeSwitchItem" value="inline">
            Inline
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </FormField>

      {state.mode === "profile" ? (
        <div className="chatSetupSection">
          <FormSelectField
            label="Profile"
            value={state.profileId}
            items={profileItems}
            loading={state.profilesLoading}
            disabled={state.profilesLoading || profileItems.length === 0}
            placeholder="Select profile"
            className="chatField"
            labelClassName="chatFieldLabel"
            triggerClassName="chatFieldTrigger"
            onValueChange={actions.onProfileIdChange}
          />
        </div>
      ) : (
        <Flex direction="column" gap="3" className="chatSetupSection">
          <Flex direction={{ initial: "column", md: "row" }} gap="3" align={{ initial: "stretch", md: "end" }}>
            <FormSelectField
              label="Import Profile"
              value={state.inlineImportProfileId}
              items={profileItems}
              loading={state.profilesLoading}
              disabled={state.profilesLoading || profileItems.length === 0}
              placeholder="Select profile"
              className="chatField"
              labelClassName="chatFieldLabel"
              triggerClassName="chatFieldTrigger"
              onValueChange={actions.onInlineImportProfileIdChange}
            />
            <Button
              className="chatSetupSecondaryButton"
              variant="soft"
              disabled={state.busy || !state.inlineImportProfileId}
              onClick={actions.onImportInlineProfile}
            >
              <span className="chatButtonIcon" aria-hidden="true">
                <ImportIcon />
              </span>
              Import
            </Button>
          </Flex>
          <ChatInlineRuntimeEditor
            draft={state.inlineDraft}
            runtimeOptions={state.runtimeOptions}
            runtimeOptionsLoading={state.runtimeOptionsLoading}
            currentModelId={state.currentModelId}
            open={state.inlineRuntimeOpen}
            disabled={state.busy}
            onProviderIdChange={actions.onProviderIdChange}
            onExecutionClassChange={actions.onExecutionClassChange}
            onOpenChange={actions.onInlineRuntimeOpenChange}
            onPrimarySurfaceChange={actions.onPrimarySurfaceChange}
            onPrimaryModelChange={actions.onPrimaryModelChange}
            onFallbackAdd={actions.onFallbackAdd}
            onFallbackRemove={actions.onFallbackRemove}
            onFallbackSurfaceChange={actions.onFallbackSurfaceChange}
            onFallbackModelChange={actions.onFallbackModelChange}
          />
        </Flex>
      )}
    </Flex>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
