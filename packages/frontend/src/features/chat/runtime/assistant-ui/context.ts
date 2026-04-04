import React from 'react';
import type { MessageStatus } from '@agent-workbench/shared';
import { MessageStatus as MessageStatusEnum } from '@agent-workbench/shared';

export const ThreadConfigContext = React.createContext<{
  assistantName?: string;
}>({});

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

export function stringifyValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
