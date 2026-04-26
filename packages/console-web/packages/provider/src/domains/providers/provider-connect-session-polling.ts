import { useCallback, useEffect, useRef } from "react";
import type { ProviderConnectSessionView } from "@code-code/agent-contract/platform/management/v1";
import { isProviderConnectSessionPollingComplete } from "./provider-connect-session-view";

const defaultPollingIntervalMs = 1500;

export function useProviderConnectSessionPolling(
  sessionId: string | undefined,
  session: ProviderConnectSessionView | undefined,
  mutateSession: () => Promise<unknown> | void,
  intervalMs = defaultPollingIntervalMs,
): void {
  useEffect(() => {
    if (!sessionId || (session && isProviderConnectSessionPollingComplete(session))) {
      return;
    }
    void mutateSession();
    const timer = window.setInterval(() => {
      void mutateSession();
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [sessionId, session, mutateSession, intervalMs]);
}

type UseProviderConnectSessionTerminalOptions = {
  sessionId: string | undefined;
  session: ProviderConnectSessionView | undefined;
  shouldHandle: (session: ProviderConnectSessionView) => boolean;
  onHandle: (session: ProviderConnectSessionView) => Promise<unknown> | void;
};

export function useProviderConnectSessionTerminal({
  sessionId,
  session,
  shouldHandle,
  onHandle,
}: UseProviderConnectSessionTerminalOptions): { reset: () => void } {
  const handledSessionId = useRef("");

  useEffect(() => {
    if (!sessionId || !session) {
      return;
    }
    if (!shouldHandle(session) || handledSessionId.current === session.sessionId) {
      return;
    }
    handledSessionId.current = session.sessionId;
    void onHandle(session);
  }, [sessionId, session, shouldHandle, onHandle]);

  const reset = useCallback(() => {
    handledSessionId.current = "";
  }, []);

  return { reset };
}
