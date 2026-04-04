import type {
  MessageStatus,
  SessionMessagePart
} from '@agent-workbench/shared';

import { formatDomainMessageStatus } from './context';
import type {
  SessionAssistantMessageRecord,
  SessionUsageData
} from './thread-adapter';

export function contentPartsToCopyText(contentParts: SessionMessagePart[]) {
  return contentParts
    .flatMap((part) => {
      if (part.type === 'text' || part.type === 'thinking') {
        return [part.text];
      }

      if (part.type === 'tool_call') {
        const lines = [`[tool] ${part.toolName}`];
        if (part.args !== undefined) {
          lines.push(JSON.stringify(part.args, null, 2));
        }
        if (part.result !== undefined) {
          lines.push(JSON.stringify(part.result, null, 2));
        }

        return [lines.join('\n')];
      }

      return [];
    })
    .join('\n\n')
    .trim();
}

export function buildRenderableAssistantContentParts(
  record: SessionAssistantMessageRecord
) {
  const runtimeThinkingText = record.runtime?.thinkingText?.trim()
    ? record.runtime.thinkingText
    : undefined;
  const errorMessage = record.message.errorPayload?.message?.trim();
  const nextParts: SessionMessagePart[] = [];
  let hasThinkingPart = false;

  for (const part of record.message.contentParts) {
    if (
      errorMessage &&
      part.type === 'text' &&
      part.text.trim() === errorMessage
    ) {
      continue;
    }

    if (part.type !== 'thinking') {
      nextParts.push(part);
      continue;
    }

    nextParts.push({
      ...part,
      text:
        !hasThinkingPart && runtimeThinkingText
          ? runtimeThinkingText
          : part.text
    });
    hasThinkingPart = true;
  }

  if (!hasThinkingPart && runtimeThinkingText) {
    return [
      {
        type: 'thinking',
        text: runtimeThinkingText
      },
      ...nextParts
    ] satisfies SessionMessagePart[];
  }

  return nextParts;
}

export function getMessageStatusLabel(
  status: MessageStatus,
  cancelledAt?: string
) {
  if (cancelledAt) {
    return '已中止';
  }

  return formatDomainMessageStatus(status);
}

export function formatUsageText(usage?: SessionUsageData) {
  if (!usage) {
    return null;
  }

  const tokens: string[] = [];
  if (usage.inputTokens) {
    tokens.push(`In: ${usage.inputTokens}`);
  }
  if (usage.outputTokens) {
    tokens.push(`Out: ${usage.outputTokens}`);
  }
  if (usage.costUsd) {
    tokens.push(`$${usage.costUsd}`);
  }
  if (usage.modelId) {
    tokens.push(usage.modelId);
  }

  return tokens.length > 0 ? tokens.join(' · ') : null;
}
