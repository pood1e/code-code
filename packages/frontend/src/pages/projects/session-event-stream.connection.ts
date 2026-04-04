import type { OutputChunk, PagedSessionMessages } from '@agent-workbench/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import {
  createSessionEventSource,
  parseSessionEvent
} from '@/api/sessions';
import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { queryKeys } from '@/query/query-keys';

import {
  applyMessageChunkToPagedMessages,
  finalizeMessageRuntimeState,
  invalidateSessionEventStreamQueries,
  isMessageChunk,
  shouldClearThinkingState,
  updateSessionCaches,
  updateThinkingRuntimeState,
  updateUsageRuntimeState
} from './session-event-stream.utils';

type RuntimeStateUpdater = (
  sessionId: string,
  messageId: string,
  updater: (
    current: SessionMessageRuntimeMap[string] | undefined
  ) => SessionMessageRuntimeMap[string]
) => void;

type SessionChunkHandlerOptions = {
  sessionId: string;
  scopeId?: string;
  queryClient: QueryClient;
  clearThinkingState: (sessionId: string) => void;
  updateMessageState: RuntimeStateUpdater;
  updateLastEventId: (eventId: number) => void;
};

type SessionReconnectOptions = {
  queryClient: QueryClient;
  scopeId?: string;
  sessionId: string;
  reconnectTimerId: number | null;
  onReconnect: () => void;
};

const SESSION_STREAM_EVENT_NAMES = [
  'thinking_delta',
  'message_delta',
  'message_result',
  'session_error',
  'tool_use',
  'usage',
  'session_status',
  'done'
] as const;

export function createSessionChunkHandler({
  clearThinkingState,
  sessionId,
  scopeId,
  queryClient,
  updateMessageState,
  updateLastEventId
}: SessionChunkHandlerOptions) {
  return (event: Event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
      return;
    }

    const chunk = parseSessionEvent(event);
    updateLastEventId(chunk.eventId);
    updateSessionCaches(queryClient, scopeId, sessionId, chunk);

    if (chunk.kind === 'done') {
      return;
    }

    if (shouldClearThinkingState(chunk)) {
      clearThinkingState(sessionId);
      return;
    }

    if (chunk.kind === 'thinking_delta') {
      updateThinkingRuntimeState(updateMessageState, sessionId, chunk);
    }

    if (chunk.kind === 'usage') {
      updateUsageRuntimeState(updateMessageState, sessionId, chunk);
      return;
    }

    if (!isMessageChunk(chunk)) {
      return;
    }

    queryClient.setQueryData<InfiniteData<PagedSessionMessages> | undefined>(
      queryKeys.sessions.messages(sessionId),
      (current) => applyMessageChunkToPagedMessages(current, sessionId, chunk)
    );

    if (chunk.kind === 'message_result' || chunk.kind === 'error') {
      finalizeMessageRuntimeState(updateMessageState, sessionId, chunk);
    }
  };
}

export function createSessionEventStream(sessionId: string, lastEventId: number) {
  return createSessionEventSource(sessionId, lastEventId);
}

export function registerSessionStreamListeners(
  source: EventSource,
  onChunk: (event: Event) => void
) {
  for (const eventName of SESSION_STREAM_EVENT_NAMES) {
    source.addEventListener(eventName, onChunk);
  }

  source.addEventListener('heartbeat', noopHeartbeatListener);
}

export function scheduleSessionStreamReconnect({
  queryClient,
  scopeId,
  sessionId,
  reconnectTimerId,
  onReconnect
}: SessionReconnectOptions) {
  if (!reconnectTimerId) {
    void invalidateSessionEventStreamQueries(
      queryClient,
      scopeId,
      sessionId
    ).catch(() => undefined);
  } else {
    window.clearTimeout(reconnectTimerId);
  }

  return window.setTimeout(onReconnect, 2000);
}

function noopHeartbeatListener() {}
