import type {
  CreatePipelineInput,
  PipelineArtifactSummary,
  PipelineDetail,
  PipelineHumanReviewDecision,
  PipelineStageSummary,
  PipelineSummary,
  StartPipelineInput,
  UpdatePipelineInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export async function listPipelines(scopeId: string) {
  const response = await apiClient.get<PipelineSummary[]>('/pipelines', {
    params: { scopeId }
  });
  return response.data;
}

export async function getPipeline(id: string) {
  const response = await apiClient.get<PipelineDetail>(`/pipelines/${id}`);
  return response.data;
}

export async function createPipeline(payload: CreatePipelineInput) {
  const response = await apiClient.post<PipelineSummary>('/pipelines', payload);
  return response.data;
}

export async function updatePipeline(id: string, payload: UpdatePipelineInput) {
  const response = await apiClient.patch<PipelineSummary>(
    `/pipelines/${id}`,
    payload
  );
  return response.data;
}

export async function deletePipeline(id: string) {
  await apiClient.delete<void>(`/pipelines/${id}`);
}

export async function cancelPipeline(id: string) {
  const response = await apiClient.post<PipelineSummary>(
    `/pipelines/${id}/cancel`
  );
  return response.data;
}

export async function startPipeline(id: string, payload: StartPipelineInput) {
  const response = await apiClient.post<PipelineSummary>(
    `/pipelines/${id}/start`,
    payload
  );
  return response.data;
}

export async function submitPipelineDecision(
  id: string,
  decision: PipelineHumanReviewDecision
) {
  await apiClient.post<void>(`/pipelines/${id}/decision`, { decision });
}

export async function listPipelineStages(pipelineId: string) {
  const response = await apiClient.get<PipelineStageSummary[]>(
    `/pipelines/${pipelineId}/stages`
  );
  return response.data;
}

export async function listPipelineArtifacts(pipelineId: string) {
  const response = await apiClient.get<PipelineArtifactSummary[]>(
    `/pipelines/${pipelineId}/artifacts`
  );
  return response.data;
}

export function getPipelineArtifactContentUrl(
  pipelineId: string,
  artifactId: string
) {
  return `/api/pipelines/${pipelineId}/artifacts/${artifactId}/content`;
}

/** Create an SSE EventSource for real-time pipeline events */
export function createPipelineEventSource(
  pipelineId: string,
  lastEventId?: number
): EventSource {
  const url = lastEventId
    ? `/api/pipelines/${pipelineId}/events?lastEventId=${lastEventId}`
    : `/api/pipelines/${pipelineId}/events`;
  return new EventSource(url);
}
