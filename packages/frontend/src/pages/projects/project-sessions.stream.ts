import type {
  OutputChunk,
  SessionMessageDetail,
  SessionMessagePart,
  SessionStatus
} from '@agent-workbench/shared';
import {
  MessageRole as MessageRoleEnum,
  MessageStatus as MessageStatusEnum,
  SessionStatus as SessionStatusEnum
} from '@agent-workbench/shared';

type ToolChunk = Extract<OutputChunk, { kind: 'tool_use' }>;
type TextChunk = Extract<
  OutputChunk,
  { kind: 'thinking_delta' } | { kind: 'message_delta' }
>;

export function getSessionStatusLabel(status: SessionStatus) {
  switch (status) {
    case SessionStatusEnum.Creating:
      return '创建中';
    case SessionStatusEnum.Ready:
      return '就绪';
    case SessionStatusEnum.Running:
      return '运行中';
    case SessionStatusEnum.Disposing:
      return '销毁中';
    case SessionStatusEnum.Disposed:
      return '已销毁';
    case SessionStatusEnum.Error:
      return '异常';
  }
}

export function getMessagePreview(message: SessionMessageDetail) {
  if (message.role === MessageRoleEnum.User) {
    return (
      getPromptValue(message.inputContent) ??
      JSON.stringify(message.inputContent ?? {})
    );
  }

  if (message.outputText?.trim()) {
    return message.outputText.trim();
  }

  if (message.errorPayload) {
    return message.errorPayload.message;
  }

  return '等待响应...';
}

export function applyOutputChunkToMessages(
  messages: SessionMessageDetail[],
  chunk: OutputChunk
) {
  switch (chunk.kind) {
    case 'thinking_delta':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Streaming,
              contentParts: appendTextPart(message, chunk),
              thinkingText:
                chunk.data.accumulatedText !== undefined
                  ? chunk.data.accumulatedText
                  : `${message.thinkingText ?? ''}${chunk.data.deltaText ?? ''}`
            }
          : message
      );
    case 'message_delta':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Streaming,
              contentParts: appendTextPart(message, chunk),
              outputText:
                chunk.data.accumulatedText !== undefined
                  ? chunk.data.accumulatedText
                  : `${message.outputText ?? ''}${chunk.data.deltaText ?? ''}`
            }
          : message
      );
    case 'message_result':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Complete,
              outputText: chunk.data.text,
              eventId: chunk.eventId
            }
          : message
      );
    case 'error':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              status: MessageStatusEnum.Error,
              errorPayload: chunk.data,
              eventId: chunk.eventId
            }
          : message
      );
    case 'tool_use':
      return messages.map((message) =>
        message.id === chunk.messageId
          ? {
              ...message,
              contentParts: upsertToolCallPart(
                message.contentParts ?? [],
                chunk
              ),
              toolUses: upsertToolUse(message, chunk)
            }
          : message
      );
    default:
      return messages;
  }
}

export function getPromptValue(input: Record<string, unknown> | null) {
  if (!input) {
    return null;
  }

  return typeof input.prompt === 'string' ? input.prompt : null;
}

function appendTextPart(
  message: SessionMessageDetail,
  chunk: TextChunk
): SessionMessagePart[] {
  const currentParts = message.contentParts ?? [];
  const actualDelta = deriveChunkDelta(message, chunk);

  if (!actualDelta) {
    return currentParts;
  }

  const nextPartType = chunk.kind === 'thinking_delta' ? 'thinking' : 'text';
  const lastPart = currentParts[currentParts.length - 1];

  if (lastPart?.type !== nextPartType) {
    return [
      ...currentParts,
      {
        type: nextPartType,
        text: actualDelta
      } as const
    ];
  }

  const nextParts = [...currentParts];
  nextParts[nextParts.length - 1] = {
    ...lastPart,
    text: lastPart.text + actualDelta
  };
  return nextParts;
}

function deriveChunkDelta(
  message: SessionMessageDetail,
  chunk: TextChunk
) {
  const previousText =
    chunk.kind === 'thinking_delta' ? message.thinkingText : message.outputText;
  const accumulatedDelta = chunk.data.accumulatedText
    ? chunk.data.accumulatedText.slice(previousText?.length || 0)
    : '';

  return accumulatedDelta || chunk.data.deltaText;
}

function upsertToolCallPart(
  parts: SessionMessagePart[],
  chunk: ToolChunk
): SessionMessagePart[] {
  const toolCallId = getToolCallId(chunk);
  const existingIndex = parts.findIndex(
    (part) =>
      part.type === 'tool_call' &&
      (part.toolCallId === toolCallId ||
        (!chunk.data.callId &&
          part.toolName === chunk.data.toolName &&
          part.result === undefined))
  );

  if (existingIndex === -1) {
    return [...parts, createToolCallPart(chunk, toolCallId)];
  }

  const existing = parts[existingIndex];
  if (existing.type !== 'tool_call') {
    return parts;
  }

  const nextParts = [...parts];
  nextParts[existingIndex] = {
    ...existing,
    toolKind: chunk.data.toolKind,
    args: chunk.data.args ?? existing.args,
    result: chunk.data.result ?? existing.result,
    isError: chunk.data.error !== undefined ? true : existing.isError
  };
  return nextParts;
}

function createToolCallPart(
  chunk: ToolChunk,
  toolCallId: string
): SessionMessagePart {
  return {
    type: 'tool_call',
    toolCallId,
    toolKind: chunk.data.toolKind,
    toolName: chunk.data.toolName,
    args: chunk.data.args,
    result: chunk.data.result,
    isError: chunk.data.error !== undefined ? true : undefined
  };
}

function upsertToolUse(
  message: SessionMessageDetail,
  chunk: ToolChunk
) {
  const toolCallId = chunk.data.callId ?? null;
  const existingIndex = message.toolUses.findIndex(
    (toolUse) =>
      (toolCallId && toolUse.callId === toolCallId) ||
      (!toolCallId &&
        toolUse.toolName === chunk.data.toolName &&
        toolUse.result == null &&
        toolUse.error == null)
  );

  if (existingIndex === -1) {
    return [
      ...message.toolUses.filter((toolUse) => toolUse.eventId !== chunk.eventId),
      createToolUseEntry(chunk, toolCallId)
    ];
  }

  const nextToolUses = [...message.toolUses];
  const existing = nextToolUses[existingIndex];
  nextToolUses[existingIndex] = {
    ...existing,
    eventId: chunk.eventId,
    toolKind: chunk.data.toolKind,
    args: chunk.data.args ?? existing.args,
    result: chunk.data.result ?? existing.result ?? null,
    error: chunk.data.error ?? existing.error ?? null,
    createdAt: new Date(chunk.timestampMs).toISOString()
  };
  return nextToolUses;
}

function createToolUseEntry(chunk: ToolChunk, toolCallId: string | null) {
  return {
    id: `event_${chunk.eventId}`,
    eventId: chunk.eventId,
    callId: toolCallId,
    toolKind: chunk.data.toolKind,
    toolName: chunk.data.toolName,
    args: chunk.data.args,
    result: chunk.data.result ?? null,
    error: chunk.data.error ?? null,
    createdAt: new Date(chunk.timestampMs).toISOString()
  };
}

function getToolCallId(chunk: ToolChunk) {
  return chunk.data.callId ?? String(chunk.eventId);
}
