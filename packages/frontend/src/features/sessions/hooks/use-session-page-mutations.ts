import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SendSessionMessageInput } from '@agent-workbench/shared';

import { deleteChat, getChat, updateChat } from '@/api/chats';
import {
  cancelSession,
  editSessionMessage,
  reloadSession,
  sendSessionMessage
} from '@/api/sessions';
import { queryKeys } from '@/query/query-keys';

const chatQueryKeys = queryKeys.chats;
const sessionQueryKeys = queryKeys.sessions;

type UseSessionPageMutationsOptions = {
  selectedChatId: string | null;
  selectedSessionId: string | null;
  projectId: string | undefined;
  clearSessionRuntimeState: (sessionId: string) => void;
};

export function useSessionPageMutations({
  selectedChatId,
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
    mutationFn: async (chatId: string) => {
      const chat = await getChat(chatId);
      await deleteChat(chatId);
      return chat;
    },
    onSuccess: async (chat) => {
      clearSessionRuntimeState(chat.sessionId);
      queryClient.removeQueries({
        queryKey: chatQueryKeys.detail(chat.id)
      });
      queryClient.removeQueries({
        queryKey: sessionQueryKeys.detail(chat.sessionId)
      });
      queryClient.removeQueries({
        queryKey: sessionQueryKeys.messages(chat.sessionId)
      });

      if (projectId) {
        queryClient.setQueryData(
          chatQueryKeys.list(projectId),
          (current: Array<{ id: string }> | undefined) =>
            current?.filter((currentChat) => currentChat.id !== chat.id)
        );

        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.list(projectId)
        });
      }
    }
  });

  const renameMutation = useMutation({
    mutationFn: ({
      chatId,
      title
    }: {
      chatId: string;
      title: string | null;
    }) => updateChat(chatId, { title }),
    onSuccess: async (chat) => {
      queryClient.setQueryData(chatQueryKeys.detail(chat.id), chat);

      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.list(projectId)
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
        queryKey: chatQueryKeys.list(scopeId)
      }),
      ...(selectedChatId
        ? [
            queryClient.invalidateQueries({
              queryKey: chatQueryKeys.detail(selectedChatId)
            })
          ]
        : [])
    ]);
  };

  return {
    sendMutation,
    cancelMutation,
    reloadMutation,
    editMutation,
    disposeMutation,
    renameMutation,
    invalidateSessionThreadState
  };
}
