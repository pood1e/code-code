import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SendSessionMessageInput } from '@agent-workbench/shared';

import {
  cancelSession,
  disposeSession,
  editSessionMessage,
  reloadSession,
  sendSessionMessage
} from '@/api/sessions';
import { queryKeys } from '@/query/query-keys';

const sessionQueryKeys = queryKeys.sessions;

type UseSessionPageMutationsOptions = {
  selectedSessionId: string | null;
  projectId: string | undefined;
  clearSessionRuntimeState: (sessionId: string) => void;
};

export function useSessionPageMutations({
  selectedSessionId,
  projectId,
  clearSessionRuntimeState
}: UseSessionPageMutationsOptions) {
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (payload: SendSessionMessageInput) => {
      return sendSessionMessage(selectedSessionId!, payload);
    },
    onSuccess: async () => {
      if (!selectedSessionId) return;
      await queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.messages(selectedSessionId)
      });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSession(selectedSessionId!)
  });

  const reloadMutation = useMutation({
    mutationFn: () => reloadSession(selectedSessionId!)
  });

  const editMutation = useMutation({
    mutationFn: ({
      messageId,
      payload
    }: {
      messageId: string;
      payload: SendSessionMessageInput;
    }) => editSessionMessage(selectedSessionId!, messageId, payload)
  });

  const disposeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await disposeSession(sessionId);
      return sessionId;
    },
    onSuccess: async (sessionId) => {
      clearSessionRuntimeState(sessionId);
      queryClient.removeQueries({
        queryKey: sessionQueryKeys.detail(sessionId)
      });
      queryClient.removeQueries({
        queryKey: sessionQueryKeys.messages(sessionId)
      });

      if (projectId) {
        queryClient.setQueryData(
          sessionQueryKeys.list(projectId),
          (current: Array<{ id: string }> | undefined) =>
            current?.filter((session) => session.id !== sessionId)
        );

        await queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.list(projectId)
        });
      }
    }
  });

  const invalidateSessionThreadState = async (
    sessionId: string,
    scopeId: string
  ) => {
    clearSessionRuntimeState(sessionId);

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.messages(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.detail(sessionId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(scopeId)
      })
    ]);
  };

  return {
    sendMutation,
    cancelMutation,
    reloadMutation,
    editMutation,
    disposeMutation,
    invalidateSessionThreadState
  };
}
