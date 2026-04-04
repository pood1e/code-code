import { create } from 'zustand';
import type { SessionMessageRuntimeMap } from '@/features/chat/runtime/assistant-ui/thread-adapter';

type SessionRuntimeState = {
  stateBySessionId: Record<string, SessionMessageRuntimeMap>;

  updateMessageState: (
    sessionId: string,
    messageId: string,
    updater: (
      current: SessionMessageRuntimeMap[string]
    ) => SessionMessageRuntimeMap[string]
  ) => void;

  clearSessionState: (sessionId: string) => void;
  clearSessionThinkingState: (sessionId: string) => void;
};

export const useSessionRuntimeStore = create<SessionRuntimeState>((set) => ({
  stateBySessionId: {},

  updateMessageState: (sessionId, messageId, updater) =>
    set((state) => ({
      stateBySessionId: {
        ...state.stateBySessionId,
        [sessionId]: {
          ...(state.stateBySessionId[sessionId] ?? {}),
          [messageId]: updater(state.stateBySessionId[sessionId]?.[messageId])
        }
      }
    })),

  clearSessionState: (sessionId) =>
    set((state) => ({
      stateBySessionId: {
        ...state.stateBySessionId,
        [sessionId]: {}
      }
    })),

  clearSessionThinkingState: (sessionId) =>
    set((state) => {
      const sessionState = state.stateBySessionId[sessionId] ?? {};
      const nextSessionState: SessionMessageRuntimeMap = {};

      for (const [messageId, messageState] of Object.entries(sessionState)) {
        nextSessionState[messageId] = messageState
          ? { ...messageState, thinkingText: undefined }
          : messageState;
      }

      return {
        stateBySessionId: {
          ...state.stateBySessionId,
          [sessionId]: nextSessionState
        }
      };
    })
}));
