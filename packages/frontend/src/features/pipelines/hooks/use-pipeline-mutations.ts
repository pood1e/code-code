import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { HumanDecision } from '@agent-workbench/shared';

import {
  cancelPipeline,
  createPipeline,
  deletePipeline,
  startPipeline,
  submitPipelineDecision
} from '@/api/pipelines';
import { queryKeys } from '@/query/query-keys';

const pipelineKeys = queryKeys.pipelines;

export function useCreatePipelineMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPipeline,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(scopeId)
      });
    }
  });
}

export function useStartPipelineMutation(pipelineId: string, scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runnerId: string) =>
      startPipeline(pipelineId, { runnerId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.detail(pipelineId)
      });
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(scopeId)
      });
    }
  });
}

export function useSubmitDecisionMutation(pipelineId: string, scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (decision: HumanDecision) =>
      submitPipelineDecision(pipelineId, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.detail(pipelineId)
      });
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(scopeId)
      });
    }
  });
}

export function useCancelPipelineMutation(pipelineId: string, scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelPipeline(pipelineId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.detail(pipelineId)
      });
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(scopeId)
      });
    }
  });
}

export function useDeletePipelineMutation(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(scopeId)
      });
    }
  });
}
