import type {
  ChatSummary,
  CreateChatInput,
  UpdateChatInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

export async function listChats(scopeId: string) {
  const response = await apiClient.get<ChatSummary[]>('/chats', {
    params: { scopeId }
  });
  return response.data;
}

export async function getChat(id: string) {
  const response = await apiClient.get<ChatSummary>(`/chats/${id}`);
  return response.data;
}

export async function createChat(payload: CreateChatInput) {
  const response = await apiClient.post<ChatSummary>('/chats', payload);
  return response.data;
}

export async function updateChat(id: string, payload: UpdateChatInput) {
  const response = await apiClient.patch<ChatSummary>(`/chats/${id}`, payload);
  return response.data;
}

export async function deleteChat(id: string) {
  await apiClient.delete<void>(`/chats/${id}`);
}
