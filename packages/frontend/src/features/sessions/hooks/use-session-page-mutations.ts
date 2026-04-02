import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { SendSessionMessageInput, PagedSessionMessages } from '@agent-workbench/shared';

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
    onSuccess: (messages: PagedSessionMessages) => {
      if (!selectedSessionId) {
        return;
      }

      queryClient.setQueryData<InfiniteData<PagedSessionMessages>>(
        sessionQueryKeys.messages(selectedSessionId),
        (current) => current ? {
          pageParams: [undefined],
          pages: [messages]
        } : current
      );
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
    mutationFn: () => disposeSession(selectedSessionId!),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKeys.detail(session.id), session);
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.list(projectId)
        }).catch(() => undefined);
      }
    }
  });

  const invalidateSessionThreadState = async (sessionId: string, scopeId: string) => {
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
