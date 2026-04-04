import type { QueryClient } from '@tanstack/react-query';

import { listAgentRunners, listAgentRunnerTypes } from '@/api/agent-runners';
import { listProjects } from '@/api/projects';
import { listProfiles } from '@/api/profiles';
import { listResources } from '@/api/resources';
import { queryKeys } from '@/query/query-keys';

export function prefetchAppLayoutData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.list(),
      queryFn: () => listProjects()
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.resources.list('skills'),
      queryFn: () => listResources('skills')
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.resources.list('mcps'),
      queryFn: () => listResources('mcps')
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.resources.list('rules'),
      queryFn: () => listResources('rules')
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.profiles.list(),
      queryFn: listProfiles
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.agentRunnerTypes.all,
      queryFn: listAgentRunnerTypes
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.agentRunners.list(),
      queryFn: () => listAgentRunners()
    })
  ]);
}
