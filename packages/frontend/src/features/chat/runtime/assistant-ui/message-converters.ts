import type {
  AppendMessage,
  ThreadMessageLike
} from '@assistant-ui/react';
import type {
  ErrorPayload,
  MessageStatus,
  SessionMessageDetail
} from '@agent-workbench/shared';
import {
  MessageRole as MessageRoleEnum,
  MessageStatus as MessageStatusEnum
} from '@agent-workbench/shared';
import type {
  ReadonlyJSONObject,
  ReadonlyJSONValue
} from 'assistant-stream/utils';

import type {
  SessionAssistantMessageRecord,
  SessionUsageData
} from './thread-adapter';

export type SessionAssistantMessageMetadata = {
  domainMessageId: string;
  domainStatus: MessageStatus;
  errorPayload: ErrorPayload | null;
  usage?: SessionUsageData;
  inputContent: Record<string, unknown> | null;
  cancelledAt: string | null;
  recoverableError: ErrorPayload | null;
  nonRecoverableError: ErrorPayload | null;
};

type AssistantContentPart = Exclude<ThreadMessageLike['content'], string>[number];

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getPromptText(message: SessionMessageDetail) {
  if (!message.inputContent) {
    return '';
  }

  if (typeof message.inputContent.prompt === 'string') {
    return message.inputContent.prompt;
  }

  return stringifyValue(message.inputContent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJsonValue(value: unknown): ReadonlyJSONValue {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeJsonValue(item)])
    );
  }

  return stringifyValue(value);
}

function normalizeJsonObject(value: Record<string, unknown>): ReadonlyJSONObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeJsonValue(item)])
  );
}

function toToolArgs(value: unknown) {
  if (isRecord(value)) {
    return normalizeJsonObject(value);
  }

  return {
    value: normalizeJsonValue(value)
  } satisfies ReadonlyJSONObject;
}

function isUserCancelled(message: SessionMessageDetail) {
  return message.errorPayload?.code === 'USER_CANCELLED' || Boolean(message.cancelledAt);
}

function toAssistantStatus(message: SessionMessageDetail): ThreadMessageLike['status'] {
  if (isUserCancelled(message)) {
    return {
      type: 'complete',
      reason: 'stop'
    };
  }

  if (message.errorPayload) {
    return {
      type: 'incomplete',
      reason: 'error',
      error: {
        code: message.errorPayload.code,
        message: message.errorPayload.message,
        recoverable: message.errorPayload.recoverable
      }
    };
  }

  if (
    message.status === MessageStatusEnum.Streaming ||
    message.status === MessageStatusEnum.Sent
  ) {
    return {
      type: 'running'
    };
  }

  return {
    type: 'complete',
    reason: 'stop'
  };
}

function buildAssistantContent(record: SessionAssistantMessageRecord) {
  const parts: AssistantContentPart[] = [];
  const { message, runtime } = record;

  if (runtime?.thinkingText?.trim()) {
    parts.push({
      type: 'reasoning',
      text: runtime.thinkingText
    });
  }

  if (message.outputText?.trim()) {
    parts.push({
      type: 'text',
      text: message.outputText
    });
  }

  for (const toolUse of message.toolUses) {
    parts.push({
      type: 'tool-call',
      toolCallId: toolUse.callId ?? `tool_${toolUse.id}`,
      toolName: toolUse.toolName,
      args: toToolArgs(toolUse.args),
      argsText: stringifyValue(toolUse.args),
      result: toolUse.result,
      isError: toolUse.error != null
    });
  }

  return parts;
}

export function convertSessionMessageRecord(
  record: SessionAssistantMessageRecord
): ThreadMessageLike {
  const { message, runtime } = record;
  const metadata: SessionAssistantMessageMetadata = {
    domainMessageId: message.id,
    domainStatus: message.status,
    errorPayload: message.errorPayload,
    usage: runtime?.usage,
    inputContent: message.inputContent,
    cancelledAt: runtime?.cancelledAt ?? message.cancelledAt,
    recoverableError:
      message.errorPayload && message.errorPayload.recoverable && !isUserCancelled(message)
        ? message.errorPayload
        : null,
    nonRecoverableError:
      message.errorPayload && !message.errorPayload.recoverable
        ? message.errorPayload
        : null
  };

  if (message.role === MessageRoleEnum.User) {
    return {
      id: message.id,
      role: 'user',
      createdAt: new Date(message.createdAt),
      content: [
        {
          type: 'text',
          text: getPromptText(message)
        }
      ],
      metadata: {
        custom: metadata
      }
    };
  }

  return {
    id: message.id,
    role: 'assistant',
    createdAt: new Date(message.createdAt),
    status: toAssistantStatus(message),
    content: buildAssistantContent(record),
    metadata: {
      custom: metadata
    }
  };
}

export function getComposerText(message: AppendMessage) {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
