import { useQuery } from '@tanstack/react-query';

import type { PipelineDetail, PipelineSummary } from '@agent-workbench/shared';

import { getPipeline, listPipelines } from '@/api/pipelines';
import { queryKeys } from '@/query/query-keys';

const pipelineKeys = queryKeys.pipelines;

export function usePipelineList(scopeId: string | undefined) {
  return useQuery<PipelineSummary[]>({
    queryKey: scopeId ? pipelineKeys.list(scopeId) : pipelineKeys.lists(),
    queryFn: () => listPipelines(scopeId!),
    enabled: Boolean(scopeId)
  });
}

export function usePipelineDetail(pipelineId: string | null | undefined) {
  return useQuery<PipelineDetail>({
    queryKey: pipelineId ? pipelineKeys.detail(pipelineId) : ['__noop__'],
    queryFn: () => getPipeline(pipelineId!),
    enabled: Boolean(pipelineId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll while pipeline is active (running or pending)
      return status === 'running' || status === 'pending' ? 1500 : false;
    }
  });
}
