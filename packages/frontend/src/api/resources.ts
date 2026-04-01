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

export function saveResource(
  kind: 'skills',
  payload: ResourcePayloadByKind['skills'],
  id?: string
): Promise<ResourceByKind['skills']>;
export function saveResource(
  kind: 'mcps',
  payload: ResourcePayloadByKind['mcps'],
  id?: string
): Promise<ResourceByKind['mcps']>;
export function saveResource(
  kind: 'rules',
  payload: ResourcePayloadByKind['rules'],
  id?: string
): Promise<ResourceByKind['rules']>;
export function saveResource<K extends ResourceKind>(
  kind: K,
  payload: ResourcePayloadByKind[K],
  id?: string
) {
  switch (kind) {
    case 'skills':
      return id
        ? updateResource('skills', id, payload as ResourcePayloadByKind['skills'])
        : createResource('skills', payload as ResourcePayloadByKind['skills']);
    case 'mcps':
      return id
        ? updateResource('mcps', id, payload as ResourcePayloadByKind['mcps'])
        : createResource('mcps', payload as ResourcePayloadByKind['mcps']);
    case 'rules':
      return id
        ? updateResource('rules', id, payload as ResourcePayloadByKind['rules'])
        : createResource('rules', payload as ResourcePayloadByKind['rules']);
  }
}

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

export const saveResourceByKind = {
  skills: (payload: ResourcePayloadByKind['skills'], id?: string) =>
    saveResource('skills', payload, id),
  mcps: (payload: ResourcePayloadByKind['mcps'], id?: string) =>
    saveResource('mcps', payload, id),
  rules: (payload: ResourcePayloadByKind['rules'], id?: string) =>
    saveResource('rules', payload, id)
};
