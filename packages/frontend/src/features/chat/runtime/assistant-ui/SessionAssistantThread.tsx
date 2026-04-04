import { useMemo } from 'react';
import type {
  RunnerTypeResponse,
  SendSessionMessageInput,
  SessionDetail,
  SessionMessageDetail
} from '@agent-workbench/shared';

import { SessionAssistantThreadBody } from './SessionAssistantThreadBody';
import { SessionAssistantRuntimeProvider } from './SessionAssistantRuntimeProvider';
import { ThreadConfigContext } from './context';
import {
  canSessionReload,
  getSessionInteractionDisabledHint,
  type SessionMessageRuntimeMap
} from './thread-adapter';
import { useSessionAssistantThreadState } from './use-session-assistant-thread-state';

export function SessionAssistantThread({
  assistantName,
  onCreateNewSession,
  session,
  messages,
  messagesReady,
  runnerType,
  runtimeState,
  onSend,
  onCancel,
  onReload,
  onEdit,
  onLoadMore
}: {
  assistantName?: string;
  onCreateNewSession?: () => void;
  session: SessionDetail;
  messages: SessionMessageDetail[];
  messagesReady: boolean;
  runnerType: RunnerTypeResponse | undefined;
  runtimeState: SessionMessageRuntimeMap;
  onSend: (payload: SendSessionMessageInput) => Promise<void>;
  onCancel: () => Promise<void>;
  onReload: () => Promise<void>;
  onEdit: (
    messageId: string,
    payload: SendSessionMessageInput
  ) => Promise<void>;
  onLoadMore?: () => void;
}) {
  const threadState = useSessionAssistantThreadState({
    messages,
    onEdit,
    onSend,
    runnerType,
    runtimeState,
    session
  });
  const configContextValue = useMemo(
    () => ({
      assistantName: assistantName ?? runnerType?.name ?? 'Agent'
    }),
    [assistantName, runnerType?.name]
  );
  const composerDisabledHint = useMemo(
    () => getSessionInteractionDisabledHint(session.status, messagesReady),
    [messagesReady, session.status]
  );
  const composerRecoveryAction = useMemo(
    () =>
      session.status === 'error' && onCreateNewSession
        ? {
            label: '新建会话',
            onClick: onCreateNewSession
          }
        : undefined,
    [onCreateNewSession, session.status]
  );
  const allowReload = useMemo(() => canSessionReload(session.status), [session.status]);

  return (
    <SessionAssistantRuntimeProvider
      messages={threadState.runtimeMessages}
      messagesReady={messagesReady}
      status={session.status}
      onNew={threadState.sendMessage}
      onCancel={onCancel}
      onReload={onReload}
      onEdit={threadState.editMessage}
    >
      <ThreadConfigContext.Provider value={configContextValue}>
        <SessionAssistantThreadBody
          {...threadState}
          canReload={allowReload}
          composerRecoveryAction={composerRecoveryAction}
          composerDisabledHint={composerDisabledHint}
          messagesReady={messagesReady}
          onLoadMore={onLoadMore}
          onReload={onReload}
        />
      </ThreadConfigContext.Provider>
    </SessionAssistantRuntimeProvider>
  );
}
