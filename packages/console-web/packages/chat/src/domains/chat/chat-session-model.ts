import { runtimePrimaryModelId } from "./runtime-model-selector";
import { runtimeRefKey } from "./session-runtime-options";
import { cloneInlineSetup, type ChatInlineSetup, type ChatMode, type ChatSetupRequest, type ChatView } from "./types";

type ReadCanSendInput = {
  chatIdReady: boolean;
  loadedChatView: ChatView | null | undefined;
  loading: boolean;
  mode: ChatMode;
  profileId: string;
  inlineDraft: ChatInlineSetup | null;
};

export function readCanSendChatRun({
  chatIdReady,
  loadedChatView,
  loading,
  mode,
  profileId,
  inlineDraft,
}: ReadCanSendInput) {
  if (!chatIdReady) {
    return false;
  }
  if (loading) {
    return false;
  }
  if (loadedChatView === null || loadedChatView === undefined) {
    return false;
  }
  if (loadedChatView.id.trim() === "") {
    return false;
  }
  if (mode === "profile") {
    return profileId.trim() !== "";
  }
  return Boolean(
    inlineDraft &&
      inlineDraft.providerId.trim() &&
      inlineDraft.executionClass.trim() &&
      runtimeRefKey(inlineDraft.runtimeConfig.providerRuntimeRef) &&
      runtimePrimaryModelId(inlineDraft.runtimeConfig.primaryModelSelector).trim(),
  );
}

export function isChatSetupReady(mode: ChatMode, profileId: string, inlineDraft: ChatInlineSetup | null) {
  if (mode === "profile") {
    return profileId.trim() !== "";
  }
  return Boolean(
    inlineDraft &&
      inlineDraft.providerId.trim() &&
      inlineDraft.executionClass.trim() &&
      runtimeRefKey(inlineDraft.runtimeConfig.providerRuntimeRef) &&
      runtimePrimaryModelId(inlineDraft.runtimeConfig.primaryModelSelector).trim(),
  );
}

export function buildChatSetupRequest(mode: ChatMode, profileId: string, inlineDraft: ChatInlineSetup | null): ChatSetupRequest {
  if (mode === "profile") {
    if (!profileId.trim()) {
      throw new Error("Profile mode requires a profile.");
    }
    const normalizedProfileID = profileId.trim();
    return { mode: "profile", displayName: `Profile: ${normalizedProfileID}`, profileId: normalizedProfileID };
  }
  if (!inlineDraft) {
    throw new Error("Inline mode requires a complete setup.");
  }
  return { mode: "inline", displayName: inlineDisplayName(inlineDraft), inline: cloneInlineSetup(inlineDraft) };
}

function inlineDisplayName(inlineDraft: ChatInlineSetup) {
  const modelID = runtimePrimaryModelId(inlineDraft.runtimeConfig.primaryModelSelector).trim();
  if (modelID) {
    return modelID;
  }
  return inlineDraft.providerId.trim() || "Inline chat";
}
