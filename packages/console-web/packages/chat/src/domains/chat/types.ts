import { create, toJson } from "@bufbuild/protobuf";
import type { Message } from "@ag-ui/core";
import { AgentResourcesSchema, type AgentResources } from "@code-code/agent-contract/agent/v1/cap";
import {
  AgentSessionRuntimeConfigSchema,
  type AgentSessionRuntimeConfig,
} from "@code-code/agent-contract/platform/agent-session/v1";

export type ChatMode = "profile" | "inline";

export type ChatInlineSetup = {
  providerId: string;
  executionClass: string;
  runtimeConfig: AgentSessionRuntimeConfig;
  resourceConfig: AgentResources;
};

export type ChatSetupRequest =
  | { mode: "profile"; displayName?: string; profileId: string }
  | { mode: "inline"; displayName?: string; inline: ChatInlineSetup };

export type ChatView = {
  id: string;
  displayName?: string;
  session: {
    id: string;
    sessionSetup: {
      mode: ChatMode;
      profileId?: string;
      providerId?: string;
      executionClass?: string;
      editable: boolean;
      runtimeConfig?: AgentSessionRuntimeConfig;
      resourceConfig?: AgentResources;
    };
    state: {
      id?: string;
      providerId?: string;
      profileId?: string;
      phase?: string;
      message?: string;
      activeRunId?: string;
      realizedRuleRevision?: string;
      realizedSkillRevision?: string;
      realizedMcpRevision?: string;
    };
  };
};

export type ChatMessage = Message;

export type ChatListView = {
  items: ChatListItem[];
  nextPageToken?: string;
};

export type ChatListItem = {
  id: string;
  displayName?: string;
  sessionId?: string;
};

export function cloneInlineSetup(setup: ChatInlineSetup): ChatInlineSetup {
  return {
    providerId: setup.providerId,
    executionClass: setup.executionClass,
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, setup.runtimeConfig),
    resourceConfig: create(AgentResourcesSchema, setup.resourceConfig),
  };
}

export function chatViewInlineSetup(view: ChatView | null | undefined): ChatInlineSetup | null {
  if (!view || view.session.sessionSetup.mode !== "inline") {
    return null;
  }
  const setup = view.session.sessionSetup;
  if (!setup.runtimeConfig || !setup.resourceConfig) {
    return null;
  }
  return {
    providerId: setup.providerId || "",
    executionClass: setup.executionClass || "",
    runtimeConfig: create(AgentSessionRuntimeConfigSchema, setup.runtimeConfig),
    resourceConfig: create(AgentResourcesSchema, setup.resourceConfig),
  };
}

export function hasPendingSetupChange(
  view: ChatView | null,
  mode: ChatMode,
  profileId: string,
  inlineDraft: ChatInlineSetup | null,
) {
  if (!view) {
    return true
  }
  if (view.session.sessionSetup.mode !== mode) {
    return true
  }
  if (mode === "profile") {
    return normalize(profileId) !== normalize(view.session.sessionSetup.profileId)
  }
  const current = chatViewInlineSetup(view)
  if (!current || !inlineDraft) {
    return true
  }
  return !sameInlineSetup(current, inlineDraft)
}

export function sameInlineSetup(left: ChatInlineSetup, right: ChatInlineSetup) {
  return (
    normalize(left.providerId) === normalize(right.providerId) &&
    normalize(left.executionClass) === normalize(right.executionClass) &&
    runtimeConfigKey(left.runtimeConfig) === runtimeConfigKey(right.runtimeConfig) &&
    resourceConfigKey(left.resourceConfig) === resourceConfigKey(right.resourceConfig)
  )
}

function runtimeConfigKey(message: AgentSessionRuntimeConfig) {
  return JSON.stringify(toJson(AgentSessionRuntimeConfigSchema, create(AgentSessionRuntimeConfigSchema, message)))
}

function resourceConfigKey(message: AgentResources) {
  return JSON.stringify(toJson(AgentResourcesSchema, create(AgentResourcesSchema, message)))
}

function normalize(value: string | undefined) {
  return value?.trim() || ""
}
