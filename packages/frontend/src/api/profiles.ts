import type { Profile } from '@agent-workbench/shared';

import { apiClient } from './client';

export type ProfilePayload = {
  name: string;
  description?: string | null;
};

export async function listProfiles() {
  const response = await apiClient.get<Profile[]>('/profiles');
  return response.data;
}

export async function createProfile(payload: ProfilePayload) {
  const response = await apiClient.post<Profile>('/profiles', payload);
  return response.data;
}

export async function updateProfile(id: string, payload: ProfilePayload) {
  const response = await apiClient.put<Profile>(`/profiles/${id}`, payload);
  return response.data;
}

export async function deleteProfile(id: string) {
  const response = await apiClient.delete<null>(`/profiles/${id}`);
  return response.data;
}
