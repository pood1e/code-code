import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import {
  buildFallbackProviderOptions,
  defaultExecutionClass,
  providerTypeLabel,
  resolveCLI,
} from "./profile-adapters";
import type {
  AgentProfileDraft,
  CLIReference,
  FallbackProviderOption,
  MCPResourceSummary,
  SelectionFallback,
  SessionRuntimeOptions,
  TextResourceSummary,
} from "./types";

type ProfileResourceKey = "mcpIds" | "skillIds" | "ruleIds";

type IdentifiedResource = {
  id: string;
};

export function readSelectedResources<TResource extends IdentifiedResource>(
  resources: readonly TResource[],
  selectedIDs: readonly string[],
) {
  const selectedSet = new Set(selectedIDs);
  return resources.filter((item) => selectedSet.has(item.id));
}

export function readAvailableResources<TResource extends IdentifiedResource>(
  resources: readonly TResource[],
  selectedIDs: readonly string[],
) {
  const selectedSet = new Set(selectedIDs);
  return resources.filter((item) => !selectedSet.has(item.id));
}

export function readSupportedProviderTypesLabel(
  cliId: string,
  clis: CLIReference[],
) {
  return (resolveCLI(cliId, clis)?.supportedProviderTypes || [])
    .map(providerTypeLabel)
    .join(" · ");
}

export function readFallbackProviderOptions(
  providerSurfaces: ProviderSurfaceBindingView[],
  vendors: VendorView[],
  clis: CLIReference[],
  draft: AgentProfileDraft,
) {
  return buildFallbackProviderOptions(
    providerSurfaces,
    vendors,
    clis,
    draft.selectionStrategy.cliId,
    draft.selectionStrategy.fallbackChain,
  );
}

export function updateDraftCLI(draft: AgentProfileDraft, cliId: string, sessionRuntimeOptions: SessionRuntimeOptions): AgentProfileDraft {
  if (draft.selectionStrategy.cliId === cliId) {
    return draft;
  }
  return {
    ...draft,
    selectionStrategy: {
      ...draft.selectionStrategy,
      cliId,
      executionClass: defaultExecutionClass(sessionRuntimeOptions, cliId),
      fallbackChain: [],
    },
  };
}

export function moveDraftFallback(draft: AgentProfileDraft, from: number, to: number): AgentProfileDraft {
  if (from === to) {
    return draft;
  }
  const chain = draft.selectionStrategy.fallbackChain;
  if (from < 0 || to < 0 || from >= chain.length || to >= chain.length) {
    return draft;
  }
  const nextChain = [...chain];
  const [moving] = nextChain.splice(from, 1);
  nextChain.splice(to, 0, moving);
  return {
    ...draft,
    selectionStrategy: {
      ...draft.selectionStrategy,
      fallbackChain: nextChain,
    },
  };
}

export function removeDraftFallback(draft: AgentProfileDraft, index: number): AgentProfileDraft {
  if (index < 0 || index >= draft.selectionStrategy.fallbackChain.length) {
    return draft;
  }
  return {
    ...draft,
    selectionStrategy: {
      ...draft.selectionStrategy,
      fallbackChain: draft.selectionStrategy.fallbackChain.filter((_, currentIndex) => currentIndex !== index),
    },
  };
}

export function appendDraftFallback(draft: AgentProfileDraft, fallback: SelectionFallback): AgentProfileDraft {
  if (draft.selectionStrategy.fallbackChain.some((item) => item.id === fallback.id)) {
    return draft;
  }
  return {
    ...draft,
    selectionStrategy: {
      ...draft.selectionStrategy,
      fallbackChain: [...draft.selectionStrategy.fallbackChain, fallback],
    },
  };
}

export function attachDraftResourceID(
  draft: AgentProfileDraft,
  key: ProfileResourceKey,
  id: string,
): AgentProfileDraft {
  if (draft[key].includes(id)) {
    return draft;
  }
  return {
    ...draft,
    [key]: [...draft[key], id],
  };
}

export function detachDraftResourceID(
  draft: AgentProfileDraft,
  key: ProfileResourceKey,
  id: string,
): AgentProfileDraft {
  if (!draft[key].includes(id)) {
    return draft;
  }
  return {
    ...draft,
    [key]: draft[key].filter((value) => value !== id),
  };
}

export function validateProfileDraft(draft: AgentProfileDraft) {
  if (!draft.name.trim()) {
    return "Profile name is required";
  }
  if (!draft.selectionStrategy.cliId || !draft.selectionStrategy.executionClass) {
    return "Session runtime image variant is required";
  }
  if (draft.selectionStrategy.fallbackChain.length === 0) {
    return "At least one fallback is required";
  }
  return null;
}

export function sanitizeProfileDraftResources(
  draft: AgentProfileDraft,
  mcps: MCPResourceSummary[],
  skills: TextResourceSummary[],
  rules: TextResourceSummary[],
): AgentProfileDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    mcpIds: filterExistingIDs(draft.mcpIds, mcps),
    skillIds: filterExistingIDs(draft.skillIds, skills),
    ruleIds: filterExistingIDs(draft.ruleIds, rules),
  };
}

function filterExistingIDs<TItem extends IdentifiedResource>(
  selectedIDs: readonly string[],
  resources: readonly TItem[],
) {
  const resourceSet = new Set(resources.map((item) => item.id));
  return Array.from(new Set(selectedIDs.filter((id) => resourceSet.has(id))));
}
