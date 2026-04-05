import { startTransition, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';
import { buildProjectChatsPath } from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';
import { useSessionEventStream } from './use-session-event-stream';

const chatQueryKeys = queryKeys.chats;
const sessionQueryKeys = queryKeys.sessions;

export function useProjectSessionsPageState() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { chatId: selectedChatId } = useParams<{ chatId?: string }>();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const { id, project, projects, isLoading, isNotFound, goToProjects } =
    useProjectPageData();

  const queries = useSessionPageQueries(
    id,
    selectedChatId ?? null,
    createPanelOpen
  );
  const clearSessionState = useSessionRuntimeStore((s) => s.clearSessionState);
  const mutations = useSessionPageMutations({
    selectedChatId: selectedChatId ?? null,
    selectedSessionId: queries.selectedChat?.sessionId ?? null,
    projectId: id,
    clearSessionRuntimeState: clearSessionState
  });
  const selectedSessionId = queries.selectedChat?.sessionId ?? null;
  const selectedRuntimeState =
    useSessionRuntimeStore((s) =>
      selectedSessionId ? s.stateBySessionId[selectedSessionId] : undefined
    ) ?? {};

  const chats = queries.chatsQuery.data ?? [];
  const showCreatePanel = createPanelOpen || chats.length === 0;

  useEffect(() => {
    if (queries.queryError) {
      handleError(queries.queryError);
    }
  }, [handleError, queries.queryError]);

  useEffect(() => {
    syncChatRoute({
      createPanelOpen,
      navigate,
      projectId: id,
      selectedChatId: selectedChatId ?? null,
      chats,
      chatsPending: queries.chatsQuery.isPending
    });
  }, [
    createPanelOpen,
    id,
    navigate,
    queries.chatsQuery.isPending,
    selectedChatId,
    chats
  ]);

  useSessionEventStream({
    scopeId: id,
    session: queries.selectedSession,
    messages: queries.flatMessages,
    messagesReady: queries.selectedSessionMessagesReady,
    queryClient
  });

  const actions = useMemo(
    () =>
      createProjectSessionsActions({
        handleError,
        invalidateSessionThreadState: mutations.invalidateSessionThreadState,
        navigate,
        projectId: id,
        queryClient,
        selectedChatId: selectedChatId ?? null,
      selectedChatPersistedId: queries.selectedChat?.id,
      selectedSessionPersistedId: queries.selectedChat?.sessionId,
      sessionMessagesQuery: queries.sessionMessagesQuery,
      chats,
      setCreatePanelOpen,
      setDetailsPanelOpen,
      showCreatePanel,
        mutations
      }),
    [
      handleError,
      id,
      mutations,
      navigate,
      queryClient,
      queries.selectedChat?.id,
      queries.selectedChat?.sessionId,
      queries.sessionMessagesQuery,
      selectedChatId,
      chats,
      showCreatePanel
    ]
  );

  return {
    ...queries,
    ...actions,
    createPanelOpen,
    detailsPanelOpen,
    disposingChatId: mutations.disposeMutation.isPending
      ? (mutations.disposeMutation.variables ?? null)
      : null,
    goToProjects,
    isLoading,
    isNotFound,
    project,
    projects,
    projectId: id,
    renamingChatId: mutations.renameMutation.isPending
      ? (mutations.renameMutation.variables?.chatId ?? null)
      : null,
    selectedRuntimeState,
    selectedChatId: selectedChatId ?? null,
    selectedSessionId,
    chats,
    showCreatePanel
  };
}

function syncChatRoute({
  createPanelOpen,
  navigate,
  projectId,
  selectedChatId,
  chats,
  chatsPending
}: {
  createPanelOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  selectedChatId: string | null;
  chats: Array<{ id: string }>;
  chatsPending: boolean;
}) {
  if (!projectId || chatsPending || createPanelOpen) {
    return;
  }

  if (chats.length === 0) {
    if (selectedChatId) {
      startTransition(() => {
        void navigate(buildProjectChatsPath(projectId), { replace: true });
      });
    }
    return;
  }

  if (selectedChatId && chats.some((chat) => chat.id === selectedChatId)) {
    return;
  }

  startTransition(() => {
    void navigate(buildProjectChatsPath(projectId, chats[0].id), {
      replace: true
    });
  });
}

function createProjectSessionsActions({
  handleError,
  invalidateSessionThreadState,
  navigate,
  projectId,
  queryClient,
  selectedChatId,
  selectedChatPersistedId,
  selectedSessionPersistedId,
  sessionMessagesQuery,
  chats,
  setCreatePanelOpen,
  setDetailsPanelOpen,
  showCreatePanel,
  mutations
}: {
  handleError: (error: unknown) => void;
  invalidateSessionThreadState: (
    sessionId: string,
    scopeId: string
  ) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  selectedChatId: string | null;
  selectedChatPersistedId?: string;
  selectedSessionPersistedId?: string;
  sessionMessagesQuery: ReturnType<typeof useSessionPageQueries>['sessionMessagesQuery'];
  chats: Array<{ id: string }>;
  setCreatePanelOpen: (value: boolean) => void;
  setDetailsPanelOpen: (value: boolean) => void;
  showCreatePanel: boolean;
  mutations: ReturnType<typeof useSessionPageMutations>;
}) {
  const selectChat = (nextChatId: string) => {
    if (!projectId) {
      return;
    }

    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
    startTransition(() => {
      void navigate(buildProjectChatsPath(projectId, nextChatId));
    });
  };

  const openCreatePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(true);
    if (projectId) {
      startTransition(() => {
        void navigate(buildProjectChatsPath(projectId));
      });
    }
  };

  const closePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
  };

  const disposeFromSelector = (chatId: string) => {
    void (async () => {
      await mutations.disposeMutation.mutateAsync(chatId);
      const remainingChats = chats.filter((chat) => chat.id !== chatId);

      if (showCreatePanel || remainingChats.length === 0) {
        openCreatePanel();
        return;
      }

      if (chatId === selectedChatId) {
        selectChat(remainingChats[0].id);
      }
    })().catch(handleError);
  };

  const renameFromSelector = (chatId: string, title: string | null) => {
    return mutations.renameMutation.mutateAsync({ chatId, title });
  };

  const refreshSession = () => {
    if (!projectId || !selectedSessionPersistedId || !selectedChatPersistedId) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.list(projectId)
      }),
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.detail(selectedChatPersistedId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.detail(selectedSessionPersistedId)
      }),
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.messages(selectedSessionPersistedId)
      })
    ]).catch(handleError);
  };

  const loadMoreMessages = () => {
    if (sessionMessagesQuery.hasNextPage) {
      void sessionMessagesQuery.fetchNextPage();
    }
  };

  const reloadSession = async () => {
    if (!projectId || !selectedSessionPersistedId) {
      return;
    }

    await mutations.reloadMutation.mutateAsync();
    await invalidateSessionThreadState(selectedSessionPersistedId, projectId);
  };

  const sendMessage = async (
    payload: Parameters<typeof mutations.sendMutation.mutateAsync>[0]
  ) => {
    await mutations.sendMutation.mutateAsync(payload);
  };

  const cancelSession = async () => {
    await mutations.cancelMutation.mutateAsync();
  };

  const editMessage = async (
    messageId: string,
    payload: Parameters<typeof mutations.editMutation.mutateAsync>[0]['payload']
  ) => {
    if (!projectId || !selectedSessionPersistedId) {
      return;
    }

    await mutations.editMutation.mutateAsync({
      messageId,
      payload
    });
    await invalidateSessionThreadState(selectedSessionPersistedId, projectId);
  };

  return {
    closePanel,
    cancelSession,
    disposeFromSelector,
    editMessage,
    loadMoreMessages,
    openCreatePanel,
    refreshSession,
    reloadSession,
    renameFromSelector,
    selectChat,
    sendMessage,
    setDetailsPanelOpen
  };
}
