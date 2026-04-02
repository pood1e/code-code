import type {
  AgentRunnerDetail,
  AgentRunnerSummary,
  CreateAgentRunnerInput,
  RunnerTypeResponse,
  UpdateAgentRunnerInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export async function listAgentRunnerTypes() {
  const response =
    await apiClient.get<RunnerTypeResponse[]>('/agent-runner-types');
  return response.data;
}

export async function listAgentRunners(name?: string) {
  const response = await apiClient.get<AgentRunnerSummary[]>('/agent-runners', {
    params: name ? { name } : undefined
  });
  return response.data;
}

export async function getAgentRunner(id: string) {
  const response = await apiClient.get<AgentRunnerDetail>(`/agent-runners/${id}`);
  return response.data;
}

export async function createAgentRunner(payload: CreateAgentRunnerInput) {
  const response = await apiClient.post<AgentRunnerDetail>(
    '/agent-runners',
    payload
  );
  return response.data;
}

export async function updateAgentRunner(
  id: string,
  payload: UpdateAgentRunnerInput
) {
  const response = await apiClient.patch<AgentRunnerDetail>(
    `/agent-runners/${id}`,
    payload
  );
  return response.data;
}

export async function deleteAgentRunner(id: string) {
  const response = await apiClient.delete<null>(`/agent-runners/${id}`);
  return response.data;
}

export async function checkAgentRunnerHealth(id: string) {
  const response = await apiClient.get<{ status: 'online' | 'offline' | 'unknown' }>(
    `/agent-runners/${id}/health`
  );
  return response.data;
}

export async function probeAgentRunnerContext(id: string) {
  const response = await apiClient.get<Record<string, Array<{ label: string; value: string } | string>>>(
    `/agent-runners/${id}/context`
  );
  return response.data;
}
