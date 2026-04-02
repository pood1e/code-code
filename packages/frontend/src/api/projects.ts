import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export async function listProjects(name?: string) {
  const response = await apiClient.get<Project[]>('/projects', {
    params: name ? { name } : undefined
  });
  return response.data;
}

export async function getProject(id: string) {
  const response = await apiClient.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function createProject(payload: CreateProjectInput) {
  const response = await apiClient.post<Project>('/projects', payload);
  return response.data;
}

export async function updateProject(id: string, payload: UpdateProjectInput) {
  const response = await apiClient.patch<Project>(`/projects/${id}`, payload);
  return response.data;
}

export async function deleteProject(id: string) {
  const response = await apiClient.delete<null>(`/projects/${id}`);
  return response.data;
}
