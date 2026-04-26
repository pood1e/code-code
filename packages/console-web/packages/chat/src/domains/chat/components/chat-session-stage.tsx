import { SessionThreadSurface } from "./session-thread-surface";
import { ChatUsageStrip } from "./chat-usage-strip";
import type { ChatProjectionState } from "../projection";
import type { ChatMessage } from "../types";

type Props = {
  busy: boolean;
  chatId: string;
  sessionId: string;
  setupDirty: boolean;
  projection: ChatProjectionState | null;
  messages: ChatMessage[];
  canSend: boolean;
  onBeforeRun: () => Promise<void>;
  onError: (message: string) => void;
  onStateChange: (state: unknown) => void;
};

export function ChatSessionStage({
  chatId,
  sessionId,
  projection,
  messages,
  canSend,
  onBeforeRun,
  onError,
  onStateChange,
}: Props) {
  return (
    <div className="chatWorkbenchStage">
      <ChatUsageStrip usage={projection?.usage} />
      <div className="chatWorkbenchThreadFrame">
        <SessionThreadSurface
          key={chatId && sessionId ? `${chatId}:${sessionId}` : "pending-session"}
          chatId={chatId}
          sessionId={sessionId}
          messages={messages}
          canSend={canSend}
          onBeforeRun={onBeforeRun}
          onError={onError}
          onStateChange={onStateChange}
        />
      </div>
    </div>
  );
}
