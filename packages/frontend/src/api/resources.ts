import type {
  McpInput,
  ResourceByKind,
  ResourceKind,
  RuleInput,
  SkillInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export type ResourcePayloadByKind = {
  skills: SkillInput;
  mcps: McpInput;
  rules: RuleInput;
};

export async function listResources<K extends ResourceKind>(
  kind: K,
  name?: string
) {
  const response = await apiClient.get<ResourceByKind[K][]>(`/${kind}`, {
    params: name ? { name } : undefined
  });
  return response.data;
}

export async function getResource<K extends ResourceKind>(kind: K, id: string) {
  const response = await apiClient.get<ResourceByKind[K]>(`/${kind}/${id}`);
  return response.data;
}

export async function createResource<K extends ResourceKind>(
  kind: K,
  payload: ResourcePayloadByKind[K]
) {
  const response = await apiClient.post<ResourceByKind[K]>(`/${kind}`, payload);
  return response.data;
}

export async function updateResource<K extends ResourceKind>(
  kind: K,
  id: string,
  payload: ResourcePayloadByKind[K]
) {
  const response = await apiClient.put<ResourceByKind[K]>(
    `/${kind}/${id}`,
    payload
  );
  return response.data;
}

export async function deleteResource(kind: ResourceKind, id: string) {
  const response = await apiClient.delete<null>(`/${kind}/${id}`);
  return response.data;
}
