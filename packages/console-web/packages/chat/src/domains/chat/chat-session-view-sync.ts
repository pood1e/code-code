import type { AgentProfileListItem } from "@code-code/agent-contract/platform/management/v1";
import { projectionFromChatView, type ChatProjectionState } from "./projection";
import { chatViewInlineSetup, type ChatInlineSetup, type ChatMode, type ChatView } from "./types";

export function readDefaultProfileSelection(
  profiles: AgentProfileListItem[],
  profileId: string,
  inlineImportProfileId: string,
) {
  const firstProfileID = profiles[0]?.profileId || "";
  return {
    profileId: !profileId && firstProfileID ? firstProfileID : null,
    inlineImportProfileId: !inlineImportProfileId && firstProfileID ? firstProfileID : null,
  };
}

export function readLoadedChatSessionState(view: ChatView): {
  mode: ChatMode;
  profileId: string;
  inlineDraft: ChatInlineSetup | null;
  projection: ChatProjectionState;
} {
  const projection = projectionFromChatView(view);
  return {
    mode: view.session.sessionSetup.mode,
    profileId: view.session.sessionSetup.profileId || "",
    inlineDraft: chatViewInlineSetup(view),
    projection: projection ?? {},
  };
}
