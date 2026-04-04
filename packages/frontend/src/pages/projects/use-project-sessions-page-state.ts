import { startTransition, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { useSessionPageMutations } from '@/features/sessions/hooks/use-session-page-mutations';
import { useSessionPageQueries } from '@/features/sessions/hooks/use-session-page-queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryKeys } from '@/query/query-keys';
import { useSessionRuntimeStore } from '@/store/session-runtime-store';
import { buildProjectSessionsPath } from '@/types/projects';

import { useProjectPageData } from './use-project-page-data';
import { useSessionEventStream } from './use-session-event-stream';

const sessionQueryKeys = queryKeys.sessions;

export function useProjectSessionsPageState() {
  const handleError = useErrorMessage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { sessionId: selectedSessionId } = useParams<{ sessionId?: string }>();
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const { id, project, projects, isLoading, isNotFound, goToProjects } =
    useProjectPageData();

  const queries = useSessionPageQueries(
    id,
    selectedSessionId ?? null,
    createPanelOpen
  );
  const clearSessionState = useSessionRuntimeStore((s) => s.clearSessionState);
  const mutations = useSessionPageMutations({
    selectedSessionId: selectedSessionId ?? null,
    projectId: id,
    clearSessionRuntimeState: clearSessionState
  });
  const selectedRuntimeState =
    useSessionRuntimeStore((s) =>
      selectedSessionId ? s.stateBySessionId[selectedSessionId] : undefined
    ) ?? {};

  const sessions = queries.sessionsQuery.data ?? [];
  const showCreatePanel = createPanelOpen || sessions.length === 0;

  useEffect(() => {
    if (queries.queryError) {
      handleError(queries.queryError);
    }
  }, [handleError, queries.queryError]);

  useEffect(() => {
    syncSessionRoute({
      createPanelOpen,
      navigate,
      projectId: id,
      selectedSessionId: selectedSessionId ?? null,
      sessions,
      sessionsPending: queries.sessionsQuery.isPending
    });
  }, [
    createPanelOpen,
    id,
    navigate,
    queries.sessionsQuery.isPending,
    selectedSessionId,
    sessions
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
        selectedSessionId: selectedSessionId ?? null,
        selectedSessionPersistedId: queries.selectedSession?.id,
        sessionMessagesQuery: queries.sessionMessagesQuery,
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
      queries.selectedSession?.id,
      queries.sessionMessagesQuery,
      selectedSessionId,
      showCreatePanel
    ]
  );

  return {
    ...queries,
    ...actions,
    createPanelOpen,
    detailsPanelOpen,
    disposingSessionId: mutations.disposeMutation.isPending
      ? (mutations.disposeMutation.variables ?? null)
      : null,
    goToProjects,
    isLoading,
    isNotFound,
    project,
    projects,
    projectId: id,
    selectedRuntimeState,
    selectedSessionId: selectedSessionId ?? null,
    sessions,
    showCreatePanel
  };
}

function syncSessionRoute({
  createPanelOpen,
  navigate,
  projectId,
  selectedSessionId,
  sessions,
  sessionsPending
}: {
  createPanelOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  projectId: string | undefined;
  selectedSessionId: string | null;
  sessions: Array<{ id: string }>;
  sessionsPending: boolean;
}) {
  if (!projectId || sessionsPending || createPanelOpen) {
    return;
  }

  if (sessions.length === 0) {
    if (selectedSessionId) {
      startTransition(() => {
        void navigate(buildProjectSessionsPath(projectId), { replace: true });
      });
    }
    return;
  }

  if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
    return;
  }

  startTransition(() => {
    void navigate(buildProjectSessionsPath(projectId, sessions[0].id), {
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
  selectedSessionId,
  selectedSessionPersistedId,
  sessionMessagesQuery,
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
  selectedSessionId: string | null;
  selectedSessionPersistedId?: string;
  sessionMessagesQuery: ReturnType<typeof useSessionPageQueries>['sessionMessagesQuery'];
  setCreatePanelOpen: (value: boolean) => void;
  setDetailsPanelOpen: (value: boolean) => void;
  showCreatePanel: boolean;
  mutations: ReturnType<typeof useSessionPageMutations>;
}) {
  const selectSession = (nextSessionId: string) => {
    if (!projectId) {
      return;
    }

    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
    startTransition(() => {
      void navigate(buildProjectSessionsPath(projectId, nextSessionId));
    });
  };

  const openCreatePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(true);
    if (projectId) {
      startTransition(() => {
        void navigate(buildProjectSessionsPath(projectId));
      });
    }
  };

  const closePanel = () => {
    setDetailsPanelOpen(false);
    setCreatePanelOpen(false);
  };

  const disposeFromSelector = (sessionId: string) => {
    void (async () => {
      await mutations.disposeMutation.mutateAsync(sessionId);
      if (sessionId === selectedSessionId || showCreatePanel) {
        openCreatePanel();
      }
    })().catch(handleError);
  };

  const refreshSession = () => {
    if (!projectId || !selectedSessionPersistedId) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(projectId)
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
    selectSession,
    sendMessage,
    setDetailsPanelOpen
  };
}
