import type { PropsWithChildren } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import type { AppendMessage } from '@assistant-ui/react';
import type { SessionStatus } from '@agent-workbench/shared';

import { useSessionAssistantRuntime } from './useSessionAssistantRuntime';
import type { SessionAssistantMessageRecord } from './thread-adapter';

type SessionAssistantRuntimeProviderProps = PropsWithChildren<{
  messages: SessionAssistantMessageRecord[];
  messagesReady: boolean;
  status: SessionStatus;
  onNew: (composerText: string, message: AppendMessage) => Promise<void>;
  onCancel?: () => Promise<void>;
  onReload?: () => Promise<void>;
  onEdit?: (
    messageId: string,
    composerText: string,
    message: AppendMessage
  ) => Promise<void>;
}>;

export function SessionAssistantRuntimeProvider({
  children,
  messages,
  messagesReady,
  status,
  onNew,
  onCancel,
  onReload,
  onEdit
}: SessionAssistantRuntimeProviderProps) {
  const runtime = useSessionAssistantRuntime({
    messages,
    messagesReady,
    status,
    onNew,
    onCancel,
    onReload,
    onEdit
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
