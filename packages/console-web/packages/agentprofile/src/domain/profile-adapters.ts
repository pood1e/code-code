import type { AgentProfile } from "@code-code/agent-contract/platform/agent-profile/v1";
import type { ProviderSurfaceBindingView } from "@code-code/agent-contract/platform/management/v1";
import { ProviderSurfaceBindingPhase } from "@code-code/agent-contract/platform/management/v1";
import type { VendorView } from "@code-code/agent-contract/platform/provider/v1";
import type { AgentProfileDraft, CLIReference, FallbackAvailability, FallbackProviderOption, ProviderType, SelectionFallback, SessionRuntimeOptions } from "./types";
import {
  PROVIDER_TYPE_ANTHROPIC,
  PROVIDER_TYPE_GEMINI,
  PROVIDER_TYPE_OPENAI_COMPATIBLE,
  PROVIDER_TYPE_OPENAI_RESPONSES
} from "./types";

type AgentFallbackMessage = NonNullable<NonNullable<AgentProfile["selectionStrategy"]>["fallbacks"]>[number];

export function createDraftProfile(sessionRuntimeOptions: SessionRuntimeOptions): AgentProfileDraft {
  const provider = firstSessionRuntimeProvider(sessionRuntimeOptions);
  return {
    profileId: "",
    name: "New Profile",
    selectionStrategy: {
      cliId: provider?.providerId || "",
      executionClass: provider?.executionClasses[0] || "",
      fallbackChain: []
    },
    mcpIds: [],
    skillIds: [],
    ruleIds: []
  };
}

export function cloneDraft(draft: AgentProfileDraft): AgentProfileDraft {
  return {
    ...draft,
    selectionStrategy: {
      ...draft.selectionStrategy,
      fallbackChain: draft.selectionStrategy.fallbackChain.map((item) => ({ ...item }))
    },
    mcpIds: [...draft.mcpIds],
    skillIds: [...draft.skillIds],
    ruleIds: [...draft.ruleIds]
  };
}

export function agentProfileToDraft(profile: AgentProfile, providerSurfaces: ProviderSurfaceBindingView[], vendors: VendorView[], sessionRuntimeOptions: SessionRuntimeOptions): AgentProfileDraft {
  const providerId = profile.selectionStrategy?.providerId || "";
  return {
    profileId: profile.profileId,
    name: profile.name,
    selectionStrategy: {
      cliId: providerId,
      executionClass: profile.selectionStrategy?.executionClass || defaultExecutionClass(sessionRuntimeOptions, providerId),
      fallbackChain: (profile.selectionStrategy?.fallbacks || []).map((item) => fallbackFromMessage(item, providerSurfaces, vendors))
    },
    mcpIds: [...profile.mcpIds],
    skillIds: [...profile.skillIds],
    ruleIds: [...profile.ruleIds]
  };
}

export function draftToAgentProfileRequest(draft: AgentProfileDraft) {
  return {
    profileId: draft.profileId,
    name: draft.name.trim(),
    selectionStrategy: {
      providerId: draft.selectionStrategy.cliId,
      executionClass: draft.selectionStrategy.executionClass,
      fallbacks: draft.selectionStrategy.fallbackChain.map((item) => ({
        providerRuntimeRef: { surfaceId: item.providerSurfaceBindingId },
        modelSelector: { case: "providerModelId" as const, value: item.modelId }
      }))
    },
    mcpIds: draft.mcpIds,
    skillIds: draft.skillIds,
    ruleIds: draft.ruleIds
  };
}

export function resolveCLI(cliId: string, clis: CLIReference[]) {
  return clis.find((item) => item.cliId === cliId) ?? null;
}

export function sessionRuntimeProviderSelectItems(sessionRuntimeOptions: SessionRuntimeOptions, currentCliId: string, clis: CLIReference[]) {
  const labels = new Map(clis.map((item) => [item.cliId, item.displayName]));
  const items = sessionRuntimeOptions.items
    .filter((item) => item.executionClasses.length > 0)
    .map((item) => ({
      value: item.providerId,
      label: item.label || labels.get(item.providerId) || item.providerId,
    }));
  if (currentCliId && !items.some((item) => item.value === currentCliId)) {
    items.push({ value: currentCliId, label: labels.get(currentCliId) || currentCliId });
  }
  return items;
}

export function sessionRuntimeExecutionClassSelectItems(sessionRuntimeOptions: SessionRuntimeOptions, cliId: string, currentExecutionClass: string) {
  const provider = sessionRuntimeOptions.items.find((item) => item.providerId === cliId);
  const items = (provider?.executionClasses || []).map((value) => ({ value, label: value }));
  if (currentExecutionClass && !items.some((item) => item.value === currentExecutionClass)) {
    items.push({ value: currentExecutionClass, label: currentExecutionClass });
  }
  return items;
}

export function defaultExecutionClass(sessionRuntimeOptions: SessionRuntimeOptions, cliId: string) {
  return sessionRuntimeOptions.items.find((item) => item.providerId === cliId)?.executionClasses[0] || "";
}

export function buildFallbackProviderOptions(
  providerSurfaces: ProviderSurfaceBindingView[],
  vendors: VendorView[],
  clis: CLIReference[],
  cliId: string,
  currentChain: SelectionFallback[]
) {
  const allowedTypes = new Set((resolveCLI(cliId, clis)?.supportedProviderTypes || []).map(Number));
  const vendorMap = new Map(vendors.map((item) => [item.vendorId, item]));
  const selected = new Set(currentChain.map((item) => `${item.providerSurfaceBindingId}:${item.modelId}`));
  const groups = new Map<string, FallbackProviderOption>();
  for (const surface of providerSurfaces) {
    const providerType = runtimeProtocol(surface);
    if (!allowedTypes.has(providerType)) {
      continue;
    }
    const surfaceOption = toSurfaceOption(surface, selected);
    if (surfaceOption.models.length === 0) {
      continue;
    }
    const groupID = `${surface.vendorId}:${providerLabel(surface)}`;
    const current = groups.get(groupID);
    if (current) {
      current.surfaces.push(surfaceOption);
      continue;
    }
    groups.set(groupID, {
      id: groupID,
      vendorId: surface.vendorId,
      label: providerLabel(surface),
      iconUrl: vendorMap.get(surface.vendorId)?.iconUrl || "",
      vendorLabel: vendorMap.get(surface.vendorId)?.displayName || surface.vendorId || "Unknown",
      surfaces: [surfaceOption]
    });
  }
  return Array.from(groups.values())
    .map((item) => ({ ...item, surfaces: item.surfaces.sort((left, right) => left.label.localeCompare(right.label)) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function firstSessionRuntimeProvider(sessionRuntimeOptions: SessionRuntimeOptions) {
  return sessionRuntimeOptions.items.find((item) => item.executionClasses.length > 0) || null;
}

export function providerTypeLabel(providerType: ProviderType) {
  switch (providerType) {
    case PROVIDER_TYPE_OPENAI_RESPONSES:
      return "OpenAI Responses";
    case PROVIDER_TYPE_OPENAI_COMPATIBLE:
      return "OpenAI Compatible";
    case PROVIDER_TYPE_ANTHROPIC:
      return "Anthropic";
    case PROVIDER_TYPE_GEMINI:
      return "Gemini";
    default:
      return "Unknown";
  }
}

function fallbackFromMessage(item: AgentFallbackMessage, providerSurfaces: ProviderSurfaceBindingView[], vendors: VendorView[]): SelectionFallback {
  const surface = providerSurfaces.find((current) => current.surfaceId === item.providerRuntimeRef?.surfaceId);
  const vendor = vendors.find((current) => current.vendorId === surface?.vendorId);
  const modelId = item.modelSelector.case === "providerModelId" ? item.modelSelector.value : item.modelSelector.value?.modelId || "";
  return {
    id: `${item.providerRuntimeRef?.surfaceId || "missing"}:${modelId}`,
    providerSurfaceBindingId: item.providerRuntimeRef?.surfaceId || "",
    vendorId: surface?.vendorId || "",
    vendorLabel: vendor?.displayName || surface?.vendorId || "Unknown",
    providerLabel: surface ? providerLabel(surface) : item.providerRuntimeRef?.surfaceId || "Missing provider",
    providerIconUrl: vendor?.iconUrl || "",
    providerType: runtimeProtocol(surface),
    surfaceLabel: surface ? surfaceLabel(surface) : "Missing surface",
    modelId,
    availability: availabilityFromPhase(surface?.status?.phase)
  };
}

function toSurfaceOption(surface: ProviderSurfaceBindingView, selected: Set<string>) {
  const availability = availabilityFromPhase(surface.status?.phase);
  const models = Array.from(new Set(modelsForSurface(surface)))
    .filter((modelId) => !selected.has(`${surface.surfaceId}:${modelId}`))
    .map((modelId) => ({ id: `${surface.surfaceId}:${modelId}`, modelId, availability }));
  return {
    providerSurfaceBindingId: surface.surfaceId,
    label: surfaceLabel(surface),
    providerType: runtimeProtocol(surface),
    availability,
    models
  };
}

function modelsForSurface(surface: ProviderSurfaceBindingView) {
  return (surface.runtime?.catalog?.models || []).map((item) => item.providerModelId || item.modelRef?.modelId || "").filter(Boolean);
}

function providerLabel(surface: ProviderSurfaceBindingView) {
  return surface.providerDisplayName || surface.displayName || surface.surfaceId;
}

function surfaceLabel(surface: ProviderSurfaceBindingView) {
  return surface.runtime?.displayName || surface.displayName || surface.surfaceId;
}

function runtimeProtocol(surface: ProviderSurfaceBindingView | undefined) {
  return Number(surface?.runtime?.access.case === "api" ? surface.runtime.access.value.protocol : 0);
}

function availabilityFromPhase(phase?: ProviderSurfaceBindingPhase): FallbackAvailability {
  switch (phase) {
    case ProviderSurfaceBindingPhase.READY:
      return "available";
    case ProviderSurfaceBindingPhase.REFRESHING:
    case ProviderSurfaceBindingPhase.STALE:
      return "degraded";
    default:
      return "unavailable";
  }
}
