import type {
  OutputChunk,
  PagedSessionMessages,
  SessionDetail,
  SessionMessageDetail,
  SessionSummary
} from '@agent-workbench/shared';
import {
  MessageRole as MessageRoleEnum,
  MessageStatus as MessageStatusEnum,
  SessionStatus as SessionStatusEnum
} from '@agent-workbench/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';
import { queryKeys } from '@/query/query-keys';

import { applyOutputChunkToMessages } from './project-sessions.form';

type MessageChunk = Extract<
  OutputChunk,
  | { kind: 'thinking_delta' }
  | { kind: 'message_delta' }
  | { kind: 'message_result' }
  | { kind: 'error' }
  | { kind: 'tool_use' }
>;

type RuntimeStateUpdater = (
  sessionId: string,
  messageId: string,
  updater: (
    current: SessionMessageRuntimeMap[string] | undefined
  ) => SessionMessageRuntimeMap[string]
) => void;

export function updateSessionCaches(
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
              chunk.kind === 'session_status'
                ? chunk.data.status
                : current.status
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
                chunk.kind === 'session_status'
                  ? chunk.data.status
                  : session.status
            }
          : session
      )
  );
}

export function isMessageChunk(chunk: OutputChunk): chunk is MessageChunk {
  return (
    chunk.kind === 'thinking_delta' ||
    chunk.kind === 'message_delta' ||
    chunk.kind === 'message_result' ||
    chunk.kind === 'error' ||
    chunk.kind === 'tool_use'
  );
}

export function applyMessageChunkToPagedMessages(
  current: InfiniteData<PagedSessionMessages> | undefined,
  sessionId: string,
  chunk: OutputChunk
) {
  if (!current || !current.pages.length || !isMessageChunk(chunk)) {
    return current;
  }

  if (!chunk.messageId) {
    return current;
  }

  const targetPageIndex = findTargetPageIndex(current, chunk.messageId);
  const targetPage = current.pages[targetPageIndex];
  const targetMessages =
    targetPageIndex === 0 && !containsMessage(targetPage.data, chunk.messageId)
      ? [
          ...targetPage.data,
          createStreamingAssistantMessage(sessionId, chunk.messageId, chunk)
        ]
      : targetPage.data;

  const nextPages = [...current.pages];
  nextPages[targetPageIndex] = {
    ...targetPage,
    data: applyOutputChunkToMessages(targetMessages, chunk)
  };

  return {
    ...current,
    pages: nextPages
  };
}

export function updateThinkingRuntimeState(
  updateMessageState: RuntimeStateUpdater,
  sessionId: string,
  chunk: Extract<OutputChunk, { kind: 'thinking_delta' }>
) {
  if (!chunk.messageId) {
    return;
  }

  updateMessageState(sessionId, chunk.messageId, (current) => ({
    ...(current ?? {}),
    thinkingText:
      chunk.data.accumulatedText ??
      `${current?.thinkingText ?? ''}${chunk.data.deltaText}`
  }));
}

export function updateUsageRuntimeState(
  updateMessageState: RuntimeStateUpdater,
  sessionId: string,
  chunk: Extract<OutputChunk, { kind: 'usage' }>
) {
  if (!chunk.messageId) {
    return;
  }

  updateMessageState(sessionId, chunk.messageId, (current) => ({
    ...(current ?? {}),
    usage: chunk.data
  }));
}

export function finalizeMessageRuntimeState(
  updateMessageState: RuntimeStateUpdater,
  sessionId: string,
  chunk: Extract<OutputChunk, { kind: 'message_result' } | { kind: 'error' }>
) {
  if (!chunk.messageId) {
    return;
  }

  updateMessageState(sessionId, chunk.messageId, (current) => ({
    ...(current ?? {}),
    thinkingText: undefined,
    cancelledAt:
      chunk.kind === 'error' && chunk.data.code === 'USER_CANCELLED'
        ? new Date(chunk.timestampMs).toISOString()
        : undefined
  }));
}

export function invalidateSessionEventStreamQueries(
  queryClient: QueryClient,
  scopeId: string | undefined,
  sessionId: string
) {
  return Promise.all([
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
  ]);
}

function findTargetPageIndex(
  current: InfiniteData<PagedSessionMessages>,
  messageId: string
) {
  const pageIndex = current.pages.findIndex((page) =>
    containsMessage(page.data, messageId)
  );

  return pageIndex === -1 ? 0 : pageIndex;
}

function containsMessage(
  messages: readonly SessionMessageDetail[],
  messageId: string
) {
  return messages.some((message) => message.id === messageId);
}

function createStreamingAssistantMessage(
  sessionId: string,
  messageId: string,
  chunk: MessageChunk
): SessionMessageDetail {
  return {
    id: messageId,
    sessionId,
    role: MessageRoleEnum.Assistant,
    status:
      chunk.kind === 'message_result'
        ? MessageStatusEnum.Complete
        : chunk.kind === 'error'
          ? MessageStatusEnum.Error
          : MessageStatusEnum.Streaming,
    inputContent: null,
    runtimeConfig: null,
    outputText: null,
    thinkingText: null,
    contentParts: [],
    errorPayload: null,
    cancelledAt: null,
    eventId: null,
    toolUses: [],
    metrics: [],
    createdAt: new Date(chunk.timestampMs).toISOString()
  };
}

export function shouldClearThinkingState(chunk: OutputChunk) {
  return (
    chunk.kind === 'session_status' &&
    chunk.data.status !== SessionStatusEnum.Running
  );
}
