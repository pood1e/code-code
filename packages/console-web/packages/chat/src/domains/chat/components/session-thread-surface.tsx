import { CopilotThread } from "./copilot-thread";
import type { ChatMessage } from "../types";

export type SessionThreadSurfaceProps = {
  chatId: string;
  sessionId: string;
  messages: ChatMessage[];
  canSend: boolean;
  onBeforeRun: () => Promise<void>;
  onError: (message: string) => void;
  onStateChange: (state: unknown) => void;
};

export function SessionThreadSurface(props: SessionThreadSurfaceProps) {
  return <CopilotThread {...props} />;
}
