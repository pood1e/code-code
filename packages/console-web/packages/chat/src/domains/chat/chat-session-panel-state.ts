import type { AgentProfileListItem } from "@code-code/agent-contract/platform/management/v1";
import type { SessionSetupPanelState } from "./components/session-setup-panel";
import type { SessionRuntimeOptions } from "./session-runtime-options";
import type { ChatInlineSetup, ChatMode } from "./types";

type CreateChatSessionPanelStateInput = {
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

export function createChatSessionPanelState(input: CreateChatSessionPanelStateInput): SessionSetupPanelState {
  return {
    mode: input.mode,
    modeLocked: input.modeLocked,
    setupDirty: input.setupDirty,
    currentModelId: input.currentModelId,
    profileId: input.profileId,
    inlineImportProfileId: input.inlineImportProfileId,
    inlineDraft: input.inlineDraft,
    inlineRuntimeOpen: input.inlineRuntimeOpen,
    profiles: input.profiles,
    profilesLoading: input.profilesLoading,
    runtimeOptions: input.runtimeOptions,
    runtimeOptionsLoading: input.runtimeOptionsLoading,
    busy: input.busy,
  };
}
