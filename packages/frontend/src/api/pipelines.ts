import type {
  CreatePipelineInput,
  PipelineArtifactSummary,
  PipelineDetail,
  PipelineStageSummary,
  PipelineSummary,
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
