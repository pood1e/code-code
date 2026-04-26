import { create } from "@bufbuild/protobuf";
import { ProviderRuntimeRefSchema, type ProviderRuntimeRef } from "@code-code/agent-contract/provider/v1";
import {
  AgentSessionRuntimeConfigSchema,
  AgentSessionRuntimeFallbackCandidateSchema,
} from "@code-code/agent-contract/platform/agent-session/v1";
import { createProviderFallbackModelSelector, createProviderModelSelector, runtimeFallbackModelId, runtimePrimaryModelId } from "./runtime-model-selector";
import type { ChatInlineSetup } from "./types";

export type SessionRuntimeOptions = {
  items: SessionRuntimeProviderOption[];
};

export type SessionRuntimeProviderOption = {
  providerId: string;
  label: string;
  executionClasses: string[];
  surfaces: SessionRuntimeSurfaceOption[];
};

export type SessionRuntimeSurfaceOption = {
  runtimeRef: ProviderRuntimeRef;
  label: string;
  models: string[];
};

export const EMPTY_SESSION_RUNTIME_OPTIONS: SessionRuntimeOptions = { items: [] };

export function sessionRuntimeProviderSelectItems(options: SessionRuntimeOptions) {
  return options.items
    .filter((item) => item.executionClasses.length > 0)
    .map((item) => ({ value: item.providerId, label: item.label }));
}

export function sessionRuntimeExecutionClassSelectItems(provider: SessionRuntimeProviderOption | null) {
  return (provider?.executionClasses || []).map((value) => ({ value, label: value }));
}

export function sessionRuntimeSurfaceSelectItems(provider: SessionRuntimeProviderOption | null) {
  return (provider?.surfaces || []).map((item) => ({ value: runtimeRefKey(item.runtimeRef), label: item.label }));
}

export function sessionRuntimeModelSelectItems(surface: SessionRuntimeSurfaceOption | null) {
  return (surface?.models || []).map((value) => ({ value, label: value }));
}

export function findSessionRuntimeProvider(options: SessionRuntimeOptions, providerId: string) {
  return options.items.find((item) => item.providerId === providerId) ?? null;
}

export function findSessionRuntimeSurface(provider: SessionRuntimeProviderOption | null, runtimeRef: string | ProviderRuntimeRef | null | undefined) {
  const key = typeof runtimeRef === "string" ? runtimeRef : runtimeRefKey(runtimeRef);
  return provider?.surfaces.find((item) => runtimeRefKey(item.runtimeRef) === key) ?? null;
}

export function normalizeInlineDraftWithSessionRuntimeOptions(draft: ChatInlineSetup, options: SessionRuntimeOptions): ChatInlineSetup {
  const provider = resolveProviderOption(options, draft.providerId);
  if (!provider) {
    return clearRuntimeSelection(draft);
  }

  const primarySurface = resolveSurfaceOption(provider, draft.runtimeConfig.providerRuntimeRef);
  const primaryModelId = resolveModelId(primarySurface, runtimePrimaryModelId(draft.runtimeConfig.primaryModelSelector));

  return {
    ...draft,
    providerId: provider.providerId,
    executionClass: provider.executionClasses.includes(draft.executionClass) ? draft.executionClass : (provider.executionClasses[0] || ""),
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      providerRuntimeRef: primarySurface
        ? cloneRuntimeRef(primarySurface.runtimeRef)
        : undefined,
      primaryModelSelector: primaryModelId ? createProviderModelSelector(primaryModelId) : undefined,
      fallbacks: draft.runtimeConfig.fallbacks
        .map((item) => normalizeFallbackCandidate(item, provider))
        .filter((item) => item !== null),
    }),
  };
}

export function defaultRuntimeModelId(surface: SessionRuntimeSurfaceOption | null) {
  return surface?.models[0] || "";
}

function clearRuntimeSelection(draft: ChatInlineSetup): ChatInlineSetup {
  return {
    ...draft,
    providerId: "",
    executionClass: "",
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, {
      ...draft.runtimeConfig,
      providerRuntimeRef: undefined,
      primaryModelSelector: undefined,
      fallbacks: [],
    }),
  };
}

function resolveProviderOption(options: SessionRuntimeOptions, providerId: string) {
  const normalizedProviderId = providerId.trim();
  if (!normalizedProviderId) {
    return null;
  }
  const usable = options.items.filter((item) => item.executionClasses.length > 0);
  const found = findSessionRuntimeProvider(options, normalizedProviderId);
  if (found && found.executionClasses.length > 0) {
    return found;
  }
  return usable[0] || null;
}

function resolveSurfaceOption(provider: SessionRuntimeProviderOption, runtimeRef: ProviderRuntimeRef | undefined) {
  const key = runtimeRefKey(runtimeRef);
  if (!key) {
    return provider.surfaces[0] || null;
  }
  return findSessionRuntimeSurface(provider, key) || provider.surfaces[0] || null;
}

function resolveModelId(surface: SessionRuntimeSurfaceOption | null, modelId: string) {
  const normalizedModelId = modelId.trim();
  if (!surface) {
    return "";
  }
  if (normalizedModelId && surface.models.includes(normalizedModelId)) {
    return normalizedModelId;
  }
  return defaultRuntimeModelId(surface);
}

function normalizeFallbackCandidate(
  item: ChatInlineSetup["runtimeConfig"]["fallbacks"][number],
  provider: SessionRuntimeProviderOption,
) {
  const surface = resolveSurfaceOption(provider, item.providerRuntimeRef);
  const modelId = resolveModelId(surface, runtimeFallbackModelId(item));
  if (!surface || !modelId) {
    return null;
  }
  return create(AgentSessionRuntimeFallbackCandidateSchema, {
    ...item,
    providerRuntimeRef: cloneRuntimeRef(surface.runtimeRef),
    modelSelector: createProviderFallbackModelSelector(modelId),
  });
}

export function runtimeRefKey(ref: ProviderRuntimeRef | null | undefined) {
  if (!ref) {
    return "";
  }
  const parts = [
    ref.providerId?.trim() || "",
    ref.surfaceId?.trim() || "",
  ];
  switch (ref.access.case) {
    case "api":
      parts.push("api", String(ref.access.value.protocol || 0));
      break;
    case "cli":
      parts.push("cli");
      break;
    default:
      parts.push("unspecified");
      break;
  }
  return parts.join("\u0000");
}

export function cloneRuntimeRef(ref: ProviderRuntimeRef) {
  return create(ProviderRuntimeRefSchema, ref);
}
