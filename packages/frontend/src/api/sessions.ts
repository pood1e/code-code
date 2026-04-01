import type {
  CreateSessionInput,
  EditSessionMessageInput,
  OutputChunk,
  SessionDetail,
  SessionMessageDetail,
  SessionSummary,
  SendSessionMessageInput
} from '@agent-workbench/shared';

import { apiBaseUrl, apiClient } from './client';

export async function listSessions(scopeId: string) {
  const response = await apiClient.get<SessionSummary[]>('/sessions', {
    params: { scopeId }
  });
  return response.data;
}

export async function getSession(id: string) {
  const response = await apiClient.get<SessionDetail>(`/sessions/${id}`);
  return response.data;
}

export async function createSession(payload: CreateSessionInput) {
  const response = await apiClient.post<SessionDetail>('/sessions', payload);
  return response.data;
}

export async function disposeSession(id: string) {
  const response = await apiClient.delete<SessionDetail>(`/sessions/${id}`);
  return response.data;
}

export async function listSessionMessages(id: string) {
  const response = await apiClient.get<SessionMessageDetail[]>(
    `/sessions/${id}/messages`
  );
  return response.data;
}

export async function sendSessionMessage(
  id: string,
  payload: SendSessionMessageInput
) {
  const response = await apiClient.post<SessionMessageDetail[]>(
    `/sessions/${id}/messages`,
    payload
  );
  return response.data;
}

export async function cancelSession(id: string) {
  const response = await apiClient.post<SessionDetail>(`/sessions/${id}/cancel`);
  return response.data;
}

export async function reloadSession(id: string) {
  const response = await apiClient.post<SessionDetail>(`/sessions/${id}/reload`);
  return response.data;
}

export async function editSessionMessage(
  sessionId: string,
  messageId: string,
  payload: EditSessionMessageInput
) {
  const response = await apiClient.post<SessionDetail>(
    `/sessions/${sessionId}/messages/${messageId}/edit`,
    payload
  );
  return response.data;
}

export function createSessionEventSource(id: string, afterEventId: number) {
  const query = new URLSearchParams({
    afterEventId: String(afterEventId)
  });

  return new EventSource(`${apiBaseUrl}/sessions/${id}/events?${query.toString()}`);
}

export function parseSessionEvent(event: { data: string }) {
  return JSON.parse(event.data) as OutputChunk;
}
