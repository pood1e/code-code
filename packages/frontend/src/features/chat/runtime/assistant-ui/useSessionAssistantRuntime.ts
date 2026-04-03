import { useCallback, useMemo } from 'react';
import type { AppendMessage, ExternalStoreAdapter } from '@assistant-ui/react';
import { useExternalStoreRuntime } from '@assistant-ui/react';
import type { SessionStatus } from '@agent-workbench/shared';

import {
  convertSessionMessageRecord,
  getComposerText
} from './message-converters';
import type { SessionAssistantMessageRecord } from './thread-adapter';
import {
  isSessionInteractionDisabled,
  isSessionRunning
} from './thread-adapter';

type UseSessionAssistantRuntimeOptions = {
  messages: SessionAssistantMessageRecord[];
  status: SessionStatus;
  onNew: (composerText: string, message: AppendMessage) => Promise<void>;
  onCancel?: () => Promise<void>;
  onReload?: () => Promise<void>;
  onEdit?: (
    messageId: string,
    composerText: string,
    message: AppendMessage
  ) => Promise<void>;
};

export function useSessionAssistantRuntime({
  messages,
  status,
  onNew,
  onCancel,
  onReload,
  onEdit
}: UseSessionAssistantRuntimeOptions) {
  const handleNew = useCallback(
    async (message: AppendMessage) => {
      await onNew(getComposerText(message), message);
    },
    [onNew]
  );
  const handleEdit = useCallback(
    async (message: AppendMessage) => {
      const messageId = message.sourceId;
      if (!messageId) {
        throw new Error('Edited message is missing sourceId');
      }

      if (!onEdit) {
        throw new Error('Edit is not supported');
      }

      await onEdit(messageId, getComposerText(message), message);
    },
    [onEdit]
  );

  const store = useMemo<ExternalStoreAdapter<SessionAssistantMessageRecord>>(
    () => ({
      messages,
      isLoading: false,
      isRunning: isSessionRunning(status),
      isDisabled: isSessionInteractionDisabled(status),
      onNew: handleNew,
      onCancel,
      onReload: onReload ? async () => onReload() : undefined,
      onEdit: onEdit ? handleEdit : undefined,
      convertMessage: convertSessionMessageRecord,
      unstable_capabilities: {
        copy: true
      }
    }),
    [handleEdit, handleNew, messages, onCancel, onEdit, onReload, status]
  );

  return useExternalStoreRuntime(store);
}
