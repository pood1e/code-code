import { create } from "@bufbuild/protobuf";
import {
  AgentSessionRuntimeConfigSchema,
  AgentSessionRuntimeFallbackCandidateSchema,
} from "@code-code/agent-contract/platform/agent-session/v1";
import type { SessionSetupPanelActions } from "./components/session-setup-panel";
import { createProviderFallbackModelSelector, createProviderModelSelector } from "./runtime-model-selector";
import {
  defaultRuntimeModelId,
  findSessionRuntimeSurface,
  findSessionRuntimeProvider,
  cloneRuntimeRef,
  normalizeInlineDraftWithSessionRuntimeOptions,
  type SessionRuntimeOptions,
} from "./session-runtime-options";
import type { ChatInlineSetup, ChatMode } from "./types";

type CreateChatSessionPanelActionsInput = {
  canEditMode: boolean;
  setMode: (value: ChatMode) => void;
  setProfileId: (value: string) => void;
  setInlineImportProfileId: (value: string) => void;
  onImportInlineProfile: () => void;
  setInlineRuntimeOpen: (open: boolean) => void;
  updateInlineDraft: (update: (current: ChatInlineSetup) => ChatInlineSetup) => void;
  runtimeOptions: SessionRuntimeOptions;
};

export function createChatSessionPanelActions({
  canEditMode,
  setMode,
  setProfileId,
  setInlineImportProfileId,
  onImportInlineProfile,
  setInlineRuntimeOpen,
  updateInlineDraft,
  runtimeOptions,
}: CreateChatSessionPanelActionsInput): SessionSetupPanelActions {
  return {
    onModeChange: (value) => {
      if (!canEditMode) {
        return;
      }
      setMode(value);
    },
    onProfileIdChange: setProfileId,
    onInlineImportProfileIdChange: setInlineImportProfileId,
    onImportInlineProfile,
    onProviderIdChange: (providerId) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions({ ...current, providerId }, runtimeOptions));
    },
    onExecutionClassChange: (executionClass) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions({ ...current, executionClass }, runtimeOptions));
    },
    onInlineRuntimeOpenChange: setInlineRuntimeOpen,
    onPrimarySurfaceChange: (surfaceValue) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(updateInlinePrimarySurface(current, surfaceValue, runtimeOptions), runtimeOptions));
    },
    onPrimaryModelChange: (modelId) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(updateInlinePrimaryModel(current, modelId), runtimeOptions));
    },
    onFallbackAdd: () => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(appendInlineFallback(current, runtimeOptions), runtimeOptions));
    },
    onFallbackRemove: (index) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(removeInlineFallback(current, index), runtimeOptions));
    },
    onFallbackSurfaceChange: (index, surfaceValue) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(updateInlineFallbackSurface(current, index, surfaceValue, runtimeOptions), runtimeOptions));
    },
    onFallbackModelChange: (index, modelId) => {
      updateInlineDraft((current) => normalizeInlineDraftWithSessionRuntimeOptions(updateInlineFallbackModel(current, index, modelId), runtimeOptions));
    },
  };
}

function updateInlinePrimarySurface(draft: ChatInlineSetup, surfaceValue: string, runtimeOptions: SessionRuntimeOptions): ChatInlineSetup {
  const surface = findSessionRuntimeSurface(findSessionRuntimeProvider(runtimeOptions, draft.providerId), surfaceValue);
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      providerRuntimeRef: surface ? cloneRuntimeRef(surface.runtimeRef) : undefined,
    }),
  };
}

function updateInlinePrimaryModel(draft: ChatInlineSetup, modelId: string): ChatInlineSetup {
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      primaryModelSelector: createProviderModelSelector(modelId),
    }),
  };
}

function appendInlineFallback(draft: ChatInlineSetup, runtimeOptions: SessionRuntimeOptions): ChatInlineSetup {
  const provider = findSessionRuntimeProvider(runtimeOptions, draft.providerId);
  const surface = findSessionRuntimeSurface(provider, draft.runtimeConfig.providerRuntimeRef)
    || provider?.surfaces[0]
    || null;
  const modelId = defaultRuntimeModelId(surface);
  if (!surface || !modelId) {
    return draft;
  }
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      fallbacks: [
        ...draft.runtimeConfig.fallbacks,
        create(AgentSessionRuntimeFallbackCandidateSchema, {
          providerRuntimeRef: cloneRuntimeRef(surface.runtimeRef),
          modelSelector: createProviderFallbackModelSelector(modelId),
        }),
      ],
    }),
  };
}

function removeInlineFallback(draft: ChatInlineSetup, index: number): ChatInlineSetup {
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      fallbacks: draft.runtimeConfig.fallbacks.filter((_, currentIndex) => currentIndex !== index),
    }),
  };
}

function updateInlineFallbackSurface(
  draft: ChatInlineSetup,
  index: number,
  surfaceValue: string,
  runtimeOptions: SessionRuntimeOptions,
): ChatInlineSetup {
  const surface = findSessionRuntimeSurface(findSessionRuntimeProvider(runtimeOptions, draft.providerId), surfaceValue);
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      fallbacks: draft.runtimeConfig.fallbacks.map((item, currentIndex) => (
        currentIndex === index
          ? create(AgentSessionRuntimeFallbackCandidateSchema, {
              ...item,
              providerRuntimeRef: surface ? cloneRuntimeRef(surface.runtimeRef) : undefined,
            })
          : item
      )),
    }),
  };
}

function updateInlineFallbackModel(
  draft: ChatInlineSetup,
  index: number,
  modelId: string,
): ChatInlineSetup {
  return {
    ...draft,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      fallbacks: draft.runtimeConfig.fallbacks.map((item, currentIndex) => (
        currentIndex === index
          ? create(AgentSessionRuntimeFallbackCandidateSchema, {
              ...item,
              modelSelector: createProviderFallbackModelSelector(modelId),
            })
          : item
      )),
    }),
  };
}
