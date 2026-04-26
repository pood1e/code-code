import { useState } from "react";
import { Button, Text } from "@radix-ui/themes";
import { ErrorCalloutIf, NoDataCallout } from "@code-code/console-web-ui";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import type { SessionSetupPanelActions, SessionSetupPanelState } from "./session-setup-panel";

type ChatSessionToolbarProps = {
  state: SessionSetupPanelState;
  actions: SessionSetupPanelActions;
  errorMessage?: string;
  statusMessage?: string;
};

export function ChatSessionToolbar({
  state,
  actions,
  errorMessage,
  statusMessage,
}: ChatSessionToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const statusTone = state.busy ? "running" : state.setupDirty ? "pending" : "ready";
  const summaryText = buildSummaryText(state);

  return (
    <div className="chatSessionToolbarShell">
      <div className="chatSessionToolbar">
        <div className="chatSessionToolbarLeft">
          <Text size="2" className="chatModelLabel">{summaryText}</Text>
        </div>
        <div className="chatSessionToolbarRight">
          <Button
            variant="ghost"
            size="1"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open session settings"
          >
            <SettingsIcon />
            Settings
          </Button>
          <span className="chatStatusDot" data-tone={statusTone} aria-label={statusTone} />
        </div>
      </div>

      {errorMessage && <ErrorCalloutIf error={errorMessage} className="chatSetupCallout" />}
      {!errorMessage && statusMessage && (
        <NoDataCallout size="1" className="chatSetupStatus">{statusMessage}</NoDataCallout>
      )}

      <ChatSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        state={state}
        actions={actions}
      />
    </div>
  );
}

function buildSummaryText(state: SessionSetupPanelState): string {
  if (state.mode === "profile") {
    if (!state.profileId) {
      return "Select a profile to get started";
    }
    const label = state.profiles.find((p) => p.profileId === state.profileId)?.name ?? state.profileId;
    return `Profile: ${label}`;
  }
  return state.currentModelId ?? "Open Settings to configure inline runtime";
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
