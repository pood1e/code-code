import { HttpAgent, type MiddlewareFunction } from "@ag-ui/client";
import { AgentCapabilitiesSchema, type AgentCapabilities } from "@ag-ui/core";
import { CopilotChat, CopilotKitProvider, useAgent } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useRef } from "react";
import { from, switchMap } from "rxjs";
import { chatActivityRenderers } from "./chat-activity-renderers";
import { ChatActivityStyles } from "./chat-activity-styles";
import { chatToolCallRenderers } from "./chat-tool-call-renderers";
import type { SessionThreadSurfaceProps } from "./session-thread-surface";
import { chatMessageHistoryKey } from "../agui-message-history";
import type { ChatMessage } from "../types";

const COPILOT_AGENT_ID = "chat-session";
const COPILOT_THROTTLE_MS = 50;
const COPILOT_LABELS = {
  modalHeaderTitle: "Conversation",
  welcomeMessageText: "Start chatting.",
} as const;

type CopilotThreadProps = SessionThreadSurfaceProps;

export function CopilotThread({
  chatId,
  sessionId,
  messages,
  canSend,
  onBeforeRun,
  onError,
  onStateChange,
}: CopilotThreadProps) {
  if (!chatId || !sessionId) {
    return (
      <SessionThreadPlaceholder
        title="Preparing session…"
        body="Backend session is being created from your current setup."
      />
    );
  }
  if (!canSend) {
    return (
      <SessionThreadPlaceholder
        title="Syncing session setup…"
        body="Changes are syncing. You can send once setup is ready."
      />
    );
  }

  const runtimeUrl = `/api/chats/${encodeURIComponent(chatId)}/session/ag-ui`;
  const agent = useMemo(() => {
    const current = new ChatSessionHttpAgent({
      url: runtimeUrl,
      threadId: sessionId,
    });
    current.use(sessionSetupMiddleware(onBeforeRun));
    return current;
  }, [onBeforeRun, runtimeUrl, sessionId]);

  const selfManagedAgents = useMemo(
    () => ({ [COPILOT_AGENT_ID]: agent }),
    [agent],
  );

  return (
    <div className="chatThread chatThread--copilot">
      <ChatActivityStyles />
      <CopilotKitProvider
        runtimeUrl={runtimeUrl}
        useSingleEndpoint
        defaultThrottleMs={COPILOT_THROTTLE_MS}
        selfManagedAgents={selfManagedAgents}
        renderActivityMessages={chatActivityRenderers}
        renderToolCalls={chatToolCallRenderers}
        onError={({ error }) => onError(error?.message || "Session runtime error.")}
      >
        <CopilotStateObserver
          agentId={COPILOT_AGENT_ID}
          sessionId={sessionId}
          onStateChange={onStateChange}
        />
        <CopilotHistoryLoader
          agentId={COPILOT_AGENT_ID}
          sessionId={sessionId}
          messages={messages}
        />
        <CopilotChat
          agentId={COPILOT_AGENT_ID}
          threadId={sessionId}
          labels={COPILOT_LABELS}
          className="chatCopilotRoot"
          chatView={{ className: "chatCopilotView" }}
        />
      </CopilotKitProvider>
    </div>
  );
}

class ChatSessionHttpAgent extends HttpAgent {
  async getCapabilities(): Promise<AgentCapabilities> {
    const response = await fetch(`${this.url}/capabilities`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Capabilities request failed: ${response.status}`);
    }
    return AgentCapabilitiesSchema.parse(await response.json());
  }
}

function sessionSetupMiddleware(onBeforeRun: () => Promise<void>): MiddlewareFunction {
  return (input, next) => from(onBeforeRun()).pipe(switchMap(() => next.run(input)));
}

function CopilotHistoryLoader({
  agentId,
  sessionId,
  messages,
}: {
  agentId: string;
  sessionId: string;
  messages: ChatMessage[];
}) {
  const { agent } = useAgent({ agentId, threadId: sessionId });
  const loadedKey = useRef("");
  const historyKey = useMemo(
    () => chatMessageHistoryKey(messages),
    [messages],
  );

  useEffect(() => {
    if (agent.isRunning || loadedKey.current === historyKey) {
      return;
    }
    agent.setMessages(messages);
    loadedKey.current = historyKey;
  }, [agent, historyKey, messages]);

  return null;
}

function CopilotStateObserver({
  agentId,
  sessionId,
  onStateChange,
}: {
  agentId: string;
  sessionId: string;
  onStateChange: (state: unknown) => void;
}) {
  const { agent } = useAgent({ agentId, threadId: sessionId });
  const currentState = agent?.state;

  useEffect(() => {
    onStateChange(currentState);
  }, [currentState, onStateChange]);

  return null;
}

function SessionThreadPlaceholder({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="chatThread">
      <div className="chatThreadViewport">
        <div className="chatThreadEmpty">
          <div className="chatSurfaceKicker">Conversation</div>
          <div className="chatThreadEmptyTitle">{title}</div>
          <div className="chatThreadEmptyBody">{body}</div>
        </div>
      </div>
      <div className="chatComposerShell">
        <div className="chatComposer">
          <textarea
            className="chatComposerInput"
            rows={3}
            disabled
            placeholder="Input is disabled until session is ready..."
          />
        </div>
      </div>
    </div>
  );
}
