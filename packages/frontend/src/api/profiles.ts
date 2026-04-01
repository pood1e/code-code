import type {
  Profile,
  ProfileDetail,
  SaveProfileInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export type ProfilePayload = {
  name: string;
  description?: string | null;
};

export async function listProfiles() {
  const response = await apiClient.get<Profile[]>('/profiles');
  return response.data;
}

export async function getProfile(id: string) {
  const response = await apiClient.get<ProfileDetail>(`/profiles/${id}`);
  return response.data;
}

export async function createProfile(payload: ProfilePayload) {
  const response = await apiClient.post<Profile>('/profiles', payload);
  return response.data;
}

export async function saveProfile(id: string, payload: SaveProfileInput) {
  const response = await apiClient.put<ProfileDetail>(
    `/profiles/${id}`,
    payload
  );
  return response.data;
}

export async function deleteProfile(id: string) {
  const response = await apiClient.delete<null>(`/profiles/${id}`);
  return response.data;
}
