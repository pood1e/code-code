import type { ChatView } from "./types";

export type ChatProjectionState = {
  session?: {
    id?: string;
    providerId?: string;
    profileId?: string;
    phase?: string;
    message?: string;
    activeRunId?: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    reasoningOutputTokens?: number;
    requestCount?: number;
    toolCallCount?: number;
    modelId?: string;
    contextWindowTokens?: number;
  };
};

export function projectionFromChatView(view: ChatView | null | undefined): ChatProjectionState | null {
  if (!view) {
    return null;
  }
  return {
    session: view.session.state,
  };
}

export function parseProjectionState(state: unknown): ChatProjectionState | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const value = state as Record<string, unknown>;
  return {
    session: parseSection(value.session),
    usage: parseUsage(value.usage),
  };
}

function parseSection(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const section = value as Record<string, unknown>;
  return {
    id: stringValue(section.id),
    providerId: stringValue(section.providerId),
    profileId: stringValue(section.profileId),
    phase: stringValue(section.phase),
    message: stringValue(section.message),
    activeRunId: stringValue(section.activeRunId),
  };
}

function parseUsage(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const usage = value as Record<string, unknown>;
  return {
    inputTokens: numberValue(usage.inputTokens),
    outputTokens: numberValue(usage.outputTokens),
    cachedInputTokens: numberValue(usage.cachedInputTokens),
    reasoningOutputTokens: numberValue(usage.reasoningOutputTokens),
    requestCount: numberValue(usage.requestCount),
    toolCallCount: numberValue(usage.toolCallCount),
    modelId: stringValue(usage.modelId),
    contextWindowTokens: numberValue(usage.contextWindowTokens),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
