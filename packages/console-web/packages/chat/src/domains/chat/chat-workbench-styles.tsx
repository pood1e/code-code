const chatWorkbenchCSS = `
.chatPage {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.chatWorkbench {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: stretch;
}

.chatWorkbenchContent {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chatSessionList {
  min-width: 0;
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-4);
  background: var(--color-panel-solid);
  overflow: hidden;
}

.chatSessionListHeader {
  min-height: 52px;
  padding: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-bottom: 1px solid var(--gray-a4);
}

.chatSessionListNewButton {
  min-height: 44px;
}

.chatSessionListItems {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
}

.chatSessionListEmpty {
  padding: var(--space-2);
}

.chatSessionListItem {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--gray-12);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.chatSessionListItem:hover,
.chatSessionListItem:focus-visible {
  background: var(--gray-a3);
}

.chatSessionListItem:focus-visible {
  outline: 2px solid var(--accent-6);
  outline-offset: 1px;
}

.chatSessionListItem[data-active="true"] {
  background: var(--accent-a3);
  color: var(--accent-12);
}

.chatSessionListItemName,
.chatSessionListItemMeta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chatSessionListItemName {
  font-size: var(--font-size-2);
  font-weight: 500;
}

.chatSessionListItemMeta {
  color: var(--gray-10);
  font-size: var(--font-size-1);
}

/* ── Toolbar ─────────────────────────────────────────────── */

.chatSessionToolbarShell {
  margin-bottom: var(--space-3);
}

.chatSessionToolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-5);
  background: var(--color-panel-solid);
  flex-wrap: wrap;
  min-height: 48px;
}

.chatSessionToolbarLeft {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1 1 0;
  min-width: 0;
}

.chatSessionToolbarRight {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.chatStatusDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chatStatusDot[data-tone="ready"]   { background: var(--green-9); }
.chatStatusDot[data-tone="pending"] { background: var(--orange-9); }
.chatStatusDot[data-tone="running"] { background: var(--blue-9); }

.chatModelLabel {
  font-size: var(--font-size-2);
  color: var(--gray-11);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.chatFieldToolbar .chatFieldLabel {
  display: none;
}

/* ── Main content area ───────────────────────────────────── */

.chatWorkbenchMain {
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-5);
  background: var(--color-panel-solid);
  overflow: hidden;
  min-height: min(72vh, 800px);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--gray-a8) 10%, transparent);
}

.chatWorkbenchStage {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chatWorkbenchThreadFrame {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

/* ── Setup panel (inside dialog) ─────────────────────────── */

.chatSetupStatus {
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-3);
  background: color-mix(in srgb, var(--gray-a2) 75%, transparent);
}

.chatSetupCallout,
.chatSetupSection {
  padding: 10px;
  border-radius: var(--radius-3);
  border: 1px solid var(--gray-a4);
  background: color-mix(in srgb, var(--color-panel) 98%, transparent);
}

.chatInlineRuntime {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chatInlineRuntimeHeader {
  gap: var(--space-2);
}

.chatInlineRuntimeSummary,
.chatInlineRuntimeEmpty {
  margin-top: 2px;
}

.chatInlineFixedSection,
.chatInlineRuntimeNotice,
.chatInlineRuntimeSection {
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-3);
  background: color-mix(in srgb, var(--color-panel) 96%, transparent);
  padding: var(--space-2);
}

.chatInlineFixedGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.chatInlineFixedItem {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chatInlineRuntimePrimaryGrid {
  margin-top: var(--space-2);
}

.chatInlineRuntimeFallbackRow {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--gray-a5);
}

/* ── Form fields ─────────────────────────────────────────── */

.chatField {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chatFieldLabel {
  color: var(--gray-12);
}

.chatFieldInput,
.chatFieldTrigger {
  width: 100%;
  border-radius: var(--radius-3);
}

.chatModeSwitch {
  flex-shrink: 0;
}

.chatButtonIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  line-height: 1;
}

.chatSetupSecondaryButton {
  border-radius: 999px;
}

.chatComposerButton {
  min-height: 36px;
  border-radius: 999px;
  padding: 0 12px;
  font: inherit;
  border: 1px solid var(--gray-a5);
  color: var(--gray-12);
  background: var(--color-panel);
}

/* ── Usage strip ─────────────────────────────────────────── */

.chatUsageStrip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--gray-a3);
}

.chatUsageChip {
  border-radius: 999px;
  background: var(--gray-a2);
  color: var(--gray-11);
  padding: 4px 8px;
  font-size: var(--font-size-1);
}

/* ── Chat thread ─────────────────────────────────────────── */

.chatThread {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: color-mix(in srgb, var(--color-panel) 96%, transparent);
}

.chatThread--copilot {
  min-height: 0;
}

.chatCopilotRoot,
.chatCopilotView {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.chatThreadViewport {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) clamp(16px, 4vw, 56px);
  overflow-y: auto;
  min-height: 0;
}

.chatThreadEmpty {
  margin: auto auto auto 0;
  max-width: 680px;
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.chatThreadEmptyTitle {
  margin: 6px 0 0;
  color: var(--gray-12);
  font-size: var(--font-size-6);
  font-weight: 600;
  line-height: 1.2;
}

.chatThreadEmptyBody,
.chatComposerHint {
  margin: 0;
  color: var(--gray-11);
  line-height: 1.45;
}

.chatThreadEmptyList {
  display: none;
}

/* ── Composer ────────────────────────────────────────────── */

.chatComposerShell {
  padding: var(--space-3) clamp(16px, 4vw, 56px);
  border-top: 1px solid var(--gray-a4);
  background: color-mix(in srgb, var(--color-panel-solid) 92%, transparent);
}

.chatComposer {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--gray-a5);
  border-radius: 20px;
  background: var(--color-panel-solid);
  padding: 10px;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--gray-a8) 8%, transparent);
}

.chatComposerInput {
  width: 100%;
  min-height: 56px;
  max-height: 180px;
  resize: none;
  border: none;
  border-radius: 14px;
  padding: 10px 12px;
  background: transparent;
  color: var(--gray-12);
}

.chatComposerInput:disabled {
  color: var(--gray-10);
  background: color-mix(in srgb, var(--gray-a2) 65%, transparent);
  cursor: not-allowed;
}

.chatComposerInput:focus-visible {
  outline: 2px solid var(--accent-6);
  outline-offset: 1px;
}

.chatComposerFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.chatComposerHints {
  display: flex;
  align-items: center;
  min-height: 30px;
}

.chatComposerActions {
  display: flex;
  gap: var(--space-2);
  margin-left: 0;
}

.chatComposerButton--secondary {
  color: var(--gray-11);
  border: 1px solid var(--gray-a5);
}

.chatComposerButton--primary {
  background: var(--accent-9);
  color: var(--accent-12);
  border-color: var(--accent-a8);
}

.chatComposerButton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chatComposerHint {
  font-size: var(--font-size-1);
}

/* ── Tool call panel ─────────────────────────────────────── */

.chatToolCallPanel {
  margin-top: 8px;
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-4);
  background: color-mix(in srgb, var(--color-panel) 96%, transparent);
  overflow: hidden;
}

.chatToolCallPanelHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--gray-a4);
  background: var(--gray-a2);
}

.chatToolCallPanelBadge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--gray-a5);
  padding: 2px 8px;
  font-size: var(--font-size-1);
  color: var(--gray-11);
}

.chatToolCallPanelName {
  font-weight: 600;
  color: var(--gray-12);
}

.chatToolCallPanelBody {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.chatToolCallPanelSection {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chatToolCallPanelLabel {
  color: var(--gray-11);
  font-size: var(--font-size-1);
}

.chatToolCallPanelCode {
  margin: 0;
  border: 1px solid var(--gray-a4);
  border-radius: var(--radius-3);
  background: var(--gray-a2);
  padding: 8px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--gray-12);
  font-size: 12px;
  line-height: 1.4;
}

/* ── Responsive ──────────────────────────────────────────── */

@media (max-width: 720px) {
  .chatWorkbench {
    grid-template-columns: 1fr;
  }

  .chatSessionListItems {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }

  .chatSessionListItem {
    flex: 0 0 180px;
  }

  .chatWorkbenchMain {
    min-height: min(70vh, 700px);
  }

  .chatSessionToolbar {
    border-radius: var(--radius-4);
    padding: var(--space-2);
  }

  .chatComposer,
  .chatComposerShell {
    border-radius: var(--radius-4);
  }

  .chatThreadViewport,
  .chatComposerShell {
    padding: var(--space-2);
  }

  .chatThreadEmptyTitle {
    font-size: var(--font-size-5);
  }
}
`;

export function ChatWorkbenchStyles() {
  return <style>{chatWorkbenchCSS}</style>;
}
