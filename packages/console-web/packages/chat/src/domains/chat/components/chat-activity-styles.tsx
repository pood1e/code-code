const chatActivityCSS = `
.chatActivityMessage {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(760px, 100%);
  min-height: 32px;
  margin: 6px 0 10px;
  padding: 6px 10px;
  border-left: 2px solid var(--gray-a6);
  background: color-mix(in srgb, var(--gray-a2) 74%, transparent);
  color: var(--gray-11);
  font-size: var(--font-size-1);
  line-height: 1.35;
}

.chatActivityMessage[data-tone="running"] {
  border-left-color: var(--accent-9);
}

.chatActivityMessage[data-tone="complete"] {
  border-left-color: var(--green-9);
}

.chatActivityMessage[data-tone="danger"] {
  border-left-color: var(--red-9);
  color: var(--red-11);
}

.chatActivityDot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
}

.chatActivityLabel {
  flex: 0 0 auto;
  font-weight: 600;
  color: var(--gray-12);
}

.chatActivityMessage[data-tone="danger"] .chatActivityLabel {
  color: var(--red-12);
}

.chatActivityDetail,
.chatActivityMeta {
  min-width: 0;
  overflow-wrap: anywhere;
}

.chatActivityDetail {
  color: var(--gray-11);
}

.chatActivityMeta {
  flex: 0 0 auto;
  color: var(--gray-10);
}

.chatActivitySteps {
  display: flex;
  flex: 1 0 100%;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  padding-left: 15px;
}

.chatActivityStep {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  max-width: 100%;
  padding: 2px 7px;
  border: 1px solid var(--gray-a5);
  color: var(--gray-11);
  overflow-wrap: anywhere;
}

.chatActivityStep[data-tone="running"] {
  border-color: var(--accent-a7);
  color: var(--accent-11);
}

.chatActivityStep[data-tone="complete"] {
  border-color: var(--green-a7);
  color: var(--green-11);
}

.chatActivityStep[data-tone="danger"] {
  border-color: var(--red-a7);
  color: var(--red-11);
}

.chatActivityStepPhase {
  flex: 0 0 auto;
  color: var(--gray-10);
}

@media (max-width: 640px) {
  .chatActivityMessage {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }
}
`;

export function ChatActivityStyles() {
  return <style>{chatActivityCSS}</style>;
}
