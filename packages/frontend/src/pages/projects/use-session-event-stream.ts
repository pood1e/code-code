import { useEffect, useRef, useState } from 'react';
import type { SessionDetail, SessionMessageDetail } from '@agent-workbench/shared';
import type { QueryClient } from '@tanstack/react-query';

import { getSessionLastEventId } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';

import {
  createSessionChunkHandler,
  createSessionEventStream,
  registerSessionStreamListeners,
  scheduleSessionStreamReconnect
} from './session-event-stream.connection';

type UseSessionEventStreamOptions = {
  scopeId?: string;
  session?: SessionDetail;
  messages: SessionMessageDetail[];
  messagesReady: boolean;
  queryClient: QueryClient;
};

export function useSessionEventStream({
  scopeId,
  session,
  messages,
  messagesReady,
  queryClient
}: UseSessionEventStreamOptions) {
  const clearThinkingState = useSessionRuntimeStore(
    (s) => s.clearSessionThinkingState
  );
  const updateMessageState = useSessionRuntimeStore(
    (s) => s.updateMessageState
  );
  const clearThinkingStateRef = useRef(clearThinkingState);
  clearThinkingStateRef.current = clearThinkingState;
  const updateMessageStateRef = useRef(updateMessageState);
  updateMessageStateRef.current = updateMessageState;
  const [streamNonce, setStreamNonce] = useState(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastEventIdRef = useRef(0);

  useEffect(() => {
    lastEventIdRef.current = 0;
  }, [session?.id]);

  useEffect(() => {
    lastEventIdRef.current = Math.max(
      lastEventIdRef.current,
      session?.lastEventId ?? 0,
      getSessionLastEventId(messages)
    );
  }, [messages, session?.id, session?.lastEventId]);

  useEffect(() => {
    if (!session?.id || !messagesReady) {
      return;
    }

    const sessionId = session.id;
    let cancelled = false;
    const source = createSessionEventStream(sessionId, lastEventIdRef.current);
    const onChunk = createSessionChunkHandler({
      clearThinkingState: clearThinkingStateRef.current,
      sessionId,
      scopeId,
      queryClient,
      updateMessageState: updateMessageStateRef.current,
      updateLastEventId: (eventId) => {
        lastEventIdRef.current = Math.max(lastEventIdRef.current, eventId);
      }
    });

    registerSessionStreamListeners(source, (event) => {
      if (cancelled) {
        return;
      }

      onChunk(event);
    });

    source.onerror = () => {
      source.close();
      if (cancelled) {
        return;
      }

      reconnectTimerRef.current = scheduleSessionStreamReconnect({
        queryClient,
        scopeId,
        sessionId,
        reconnectTimerId: reconnectTimerRef.current,
        onReconnect: () => {
          reconnectTimerRef.current = null;
          setStreamNonce((value) => value + 1);
        }
      });
    };

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      source.close();
    };
  }, [messagesReady, queryClient, scopeId, session?.id, streamNonce]);
}
