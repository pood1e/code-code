import { useEffect, useRef, useState } from 'react';
import type {
  OutputChunk,
  SessionDetail,
  SessionMessageDetail,
  PagedSessionMessages,
  SessionSummary
} from '@agent-workbench/shared';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';
import type { QueryClient, InfiniteData } from '@tanstack/react-query';

import {
  createSessionEventSource,
  parseSessionEvent
} from '@/api/sessions';
import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { getSessionLastEventId } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { queryKeys } from '@/query/query-keys';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';

import { applyOutputChunkToMessages } from './project-sessions.form';

type UseSessionEventStreamOptions = {
  scopeId?: string;
  session?: SessionDetail;
  messages: SessionMessageDetail[];
  messagesReady: boolean;
  queryClient: QueryClient;
};

function updateSessionCaches(
  queryClient: QueryClient,
  scopeId: string | undefined,
  sessionId: string,
  chunk: OutputChunk
) {
  queryClient.setQueryData<SessionDetail | undefined>(
    queryKeys.sessions.detail(sessionId),
    (current) =>
      current
        ? {
            ...current,
            lastEventId: Math.max(current.lastEventId, chunk.eventId),
            status:
              chunk.kind === 'session_status' ? chunk.data.status : current.status
          }
        : current
  );

  if (!scopeId) {
    return;
  }

  queryClient.setQueryData<SessionSummary[] | undefined>(
    queryKeys.sessions.list(scopeId),
    (current) =>
      current?.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              lastEventId: Math.max(session.lastEventId, chunk.eventId),
              status:
                chunk.kind === 'session_status' ? chunk.data.status : session.status
            }
          : session
      )
  );
}

export function useSessionEventStream({
  scopeId,
  session,
  messages,
  messagesReady,
  queryClient
}: UseSessionEventStreamOptions) {
  const updateMessageState = useSessionRuntimeStore((s) => s.updateMessageState);
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
    const source = createSessionEventSource(sessionId, lastEventIdRef.current);

    const onChunk = (event: Event) => {
      if (cancelled) {
        return;
      }

      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        return;
      }

      const chunk = parseSessionEvent(event);
      lastEventIdRef.current = Math.max(lastEventIdRef.current, chunk.eventId);
      updateSessionCaches(queryClient, scopeId, sessionId, chunk);

      if (chunk.kind === 'done') {
        // done is a message-level completion signal, do not close the session-level SSE connection
        return;
      }

      if (chunk.kind === 'session_status') {
        if (chunk.data.status !== SessionStatusEnum.Running) {
          const store = useSessionRuntimeStore.getState();
          const sessionState = store.stateBySessionId[sessionId] ?? {};
          const cleared: Record<string, SessionMessageRuntimeMap[string]> = {};
          for (const [messageId, value] of Object.entries(sessionState)) {
            cleared[messageId] = value ? { ...value, thinkingText: undefined } : value;
          }
          useSessionRuntimeStore.setState((state) => ({
            stateBySessionId: {
              ...state.stateBySessionId,
              [sessionId]: cleared
            }
          }));
        }
        return;
      }

      if (chunk.kind === 'thinking_delta' && chunk.messageId) {
        updateMessageStateRef.current(sessionId, chunk.messageId, (current) => ({
          ...(current ?? {}),
          thinkingText:
            chunk.data.accumulatedText ??
            `${current?.thinkingText ?? ''}${chunk.data.deltaText}`
        }));
        return;
      }

      if (chunk.kind === 'usage' && chunk.messageId) {
        updateMessageStateRef.current(sessionId, chunk.messageId, (current) => ({
          ...(current ?? {}),
          usage: chunk.data
        }));
        return;
      }

      if (
        chunk.kind === 'message_delta' ||
        chunk.kind === 'message_result' ||
        chunk.kind === 'error' ||
        chunk.kind === 'tool_use'
      ) {
        queryClient.setQueryData<InfiniteData<PagedSessionMessages> | undefined>(
          queryKeys.sessions.messages(sessionId),
          (current) => {
            if (!current || !current.pages.length) return current;
            
            const firstPage = current.pages[0];
            const updatedFirstPage = {
              ...firstPage,
              data: applyOutputChunkToMessages(firstPage.data, chunk)
            };
            
            return {
              ...current,
              pages: [updatedFirstPage, ...current.pages.slice(1)]
            };
          }
        );

        if (
          (chunk.kind === 'message_result' || chunk.kind === 'error') &&
          chunk.messageId
        ) {
          updateMessageStateRef.current(sessionId, chunk.messageId, (current) => ({
            ...(current ?? {}),
            thinkingText: undefined,
            cancelledAt:
              chunk.kind === 'error' && chunk.data.code === 'USER_CANCELLED'
                ? new Date(chunk.timestampMs).toISOString()
                : undefined
          }));
        }
      }
    };

    source.addEventListener('thinking_delta', onChunk);
    source.addEventListener('message_delta', onChunk);
    source.addEventListener('message_result', onChunk);
    source.addEventListener('session_error', onChunk);
    source.addEventListener('tool_use', onChunk);
    source.addEventListener('usage', onChunk);
    source.addEventListener('session_status', onChunk);
    source.addEventListener('done', onChunk);
    source.addEventListener('heartbeat', () => {});
    source.onerror = () => {
      source.close();
      if (cancelled) {
        return;
      }

      // Instead of an aggressive immediate refetch on every disconnect, we only invalidate once every few seconds
      // to avoid request storms on network drop or server restart.
      if (!reconnectTimerRef.current) {
        void Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.sessions.messages(sessionId)
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.sessions.detail(sessionId)
          }),
          scopeId
            ? queryClient.invalidateQueries({
                queryKey: queryKeys.sessions.list(scopeId)
              })
            : Promise.resolve()
        ]).catch(() => undefined);
      } else {
        window.clearTimeout(reconnectTimerRef.current);
      }

      // Linear backoff (or simple fixed interval, e.g. 2s) to avoid spamming the backend
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        setStreamNonce((value) => value + 1);
      }, 2000);
    };

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      source.close();
    };
  }, [
    messagesReady,
    queryClient,
    scopeId,
    session?.id,
    streamNonce
  ]);
}
