import { useMemo } from 'react';
import { useQueries, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { PagedSessionMessages } from '@agent-workbench/shared';

import {
  getAgentRunner,
  listAgentRunners,
  listAgentRunnerTypes
} from '@/api/agent-runners';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { getSession, listSessionMessages, listSessions } from '@/api/sessions';
import { NOOP_QUERY_KEY, queryKeys } from '@/query/query-keys';

const sessionQueryKeys = queryKeys.sessions;

export function useSessionPageQueries(
  projectId: string | undefined,
  selectedSessionId: string | null,
  createPanelOpen: boolean
) {
  const [
    runnerTypesQuery,
    runnersQuery,
    profilesQuery,
    skillsQuery,
    mcpsQuery,
    rulesQuery
  ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.agentRunnerTypes.all,
        queryFn: listAgentRunnerTypes
      },
      {
        queryKey: queryKeys.agentRunners.list(),
        queryFn: () => listAgentRunners()
      },
      {
        queryKey: queryKeys.profiles.list(),
        queryFn: listProfiles,
        enabled: createPanelOpen
      },
      {
        queryKey: queryKeys.resources.list('skills'),
        queryFn: () => listResources('skills'),
        enabled: createPanelOpen
      },
      {
        queryKey: queryKeys.resources.list('mcps'),
        queryFn: () => listResources('mcps'),
        enabled: createPanelOpen
      },
      {
        queryKey: queryKeys.resources.list('rules'),
        queryFn: () => listResources('rules'),
        enabled: createPanelOpen
      }
    ]
  });

  const sessionsQuery = useQuery({
    queryKey: projectId
      ? sessionQueryKeys.list(projectId)
      : sessionQueryKeys.lists(),
    queryFn: () => listSessions(projectId!),
    enabled: Boolean(projectId)
  });

  const sessionDetailQuery = useQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.detail(selectedSessionId)
      : NOOP_QUERY_KEY,
    queryFn: () => getSession(selectedSessionId!),
    enabled: Boolean(selectedSessionId)
  });

  const sessionMessagesQuery = useInfiniteQuery({
    queryKey: selectedSessionId
      ? sessionQueryKeys.messages(selectedSessionId)
      : NOOP_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      listSessionMessages(selectedSessionId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: PagedSessionMessages) =>
      lastPage.nextCursor || undefined,
    enabled: Boolean(selectedSessionId)
  });

  const selectedRunnerQuery = useQuery({
    queryKey: sessionDetailQuery.data?.runnerId
      ? queryKeys.agentRunners.detail(sessionDetailQuery.data.runnerId)
      : NOOP_QUERY_KEY,
    queryFn: () => getAgentRunner(sessionDetailQuery.data!.runnerId),
    enabled: Boolean(sessionDetailQuery.data?.runnerId)
  });

  const flatMessages = useMemo(() => {
    if (!sessionMessagesQuery.data) return [];
    return [...sessionMessagesQuery.data.pages]
      .reverse()
      .flatMap((page) => page.data);
  }, [sessionMessagesQuery.data]);

  const selectedSession = sessionDetailQuery.data;
  const runnerTypes = useMemo(
    () => runnerTypesQuery.data ?? [],
    [runnerTypesQuery.data]
  );
  const runners = useMemo(() => runnersQuery.data ?? [], [runnersQuery.data]);
  const profiles = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data]
  );
  const resources = useMemo(
    () => ({
      skills: skillsQuery.data ?? [],
      mcps: mcpsQuery.data ?? [],
      rules: rulesQuery.data ?? []
    }),
    [mcpsQuery.data, rulesQuery.data, skillsQuery.data]
  );
  const selectedRunnerType = useMemo(() => {
    if (!selectedSession) {
      return undefined;
    }

    return runnerTypes.find(
      (runnerType) => runnerType.id === selectedSession.runnerType
    );
  }, [runnerTypes, selectedSession]);

  const runnerNameById = useMemo(
    () =>
      Object.fromEntries(
        runners.map((runner) => [runner.id, runner.name] as const)
      ),
    [runners]
  );

  const selectedSessionMessagesReady =
    sessionMessagesQuery.status === 'success';

  // Aggregate all query errors for centralized handling
  const queryError =
    sessionsQuery.error ??
    sessionDetailQuery.error ??
    sessionMessagesQuery.error ??
    selectedRunnerQuery.error ??
    runnerTypesQuery.error ??
    runnersQuery.error ??
    profilesQuery.error ??
    skillsQuery.error ??
    mcpsQuery.error ??
    rulesQuery.error;

  return {
    sessionsQuery,
    sessionDetailQuery,
    sessionMessagesQuery,
    selectedRunnerQuery,
    selectedSession,
    flatMessages,
    runnerTypes,
    runners,
    profiles,
    resources,
    selectedRunnerType,
    runnerNameById,
    selectedSessionMessagesReady,
    queryError
  };
}
