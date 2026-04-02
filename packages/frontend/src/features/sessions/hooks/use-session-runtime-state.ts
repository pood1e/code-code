import { useCallback, useState } from 'react';
import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';

export function useSessionRuntimeState() {
  const [runtimeStateBySessionId, setRuntimeStateBySessionId] = useState<
    Record<string, SessionMessageRuntimeMap>
  >({});

  const updateSessionRuntimeMessageState = useCallback(
    (
      sessionId: string,
      messageId: string,
      updater: (
        current: SessionMessageRuntimeMap[string]
      ) => SessionMessageRuntimeMap[string]
    ) => {
      setRuntimeStateBySessionId((current) => ({
        ...current,
        [sessionId]: {
          ...(current[sessionId] ?? {}),
          [messageId]: updater(current[sessionId]?.[messageId])
        }
      }));
    },
    []
  );

  const clearSessionRuntimeState = useCallback((sessionId: string) => {
    setRuntimeStateBySessionId((current) => ({
      ...current,
      [sessionId]: {}
    }));
  }, []);

  return {
    runtimeStateBySessionId,
    setRuntimeStateBySessionId,
    updateSessionRuntimeMessageState,
    clearSessionRuntimeState
  };
}
