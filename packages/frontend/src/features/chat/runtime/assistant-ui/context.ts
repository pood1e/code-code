import React from 'react';
import { useAuiState } from '@assistant-ui/react';
import type { MessageStatus } from '@agent-workbench/shared';
import { MessageStatus as MessageStatusEnum } from '@agent-workbench/shared';
import type { SessionAssistantMessageMetadata } from './message-converters';

export const ThreadConfigContext = React.createContext<{ assistantName?: string }>({});

export function formatDomainMessageStatus(status: MessageStatus) {
  switch (status) {
    case MessageStatusEnum.Error:
      return '异常';
    case MessageStatusEnum.Sent:
    case MessageStatusEnum.Streaming:
    case MessageStatusEnum.Complete:
    default:
      return null;
  }
}

export function isSessionAssistantMessageMetadata(
  value: unknown
): value is SessionAssistantMessageMetadata {
  return typeof value === 'object' && value !== null;
}

export function stringifyValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (value instanceof Error) {
      return value.message;
    }

    return Object.prototype.toString.call(value);
  }
}

export function useCurrentMessageMetadata() {
  const customMetadata = useAuiState((state) => state.message.metadata.custom);
  return isSessionAssistantMessageMetadata(customMetadata)
    ? customMetadata
    : undefined;
}
