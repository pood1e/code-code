import type {
  CreateNotificationChannelInput,
  NotificationChannelSummary,
  NotificationTaskSummary,
  NotificationTaskStatus,
  UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import { apiClient } from './client';

// ─── Channel Types ────────────────────────────────────────────────────────────

export async function listChannelTypes(): Promise<string[]> {
  const response = await apiClient.get<string[]>('/notifications/channel-types');
  return response.data;
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function listChannels(
  scopeId?: string
): Promise<NotificationChannelSummary[]> {
  const response = await apiClient.get<NotificationChannelSummary[]>(
    '/notifications/channels',
    { params: scopeId !== undefined ? { scopeId } : undefined }
  );
  return response.data;
}

export async function getChannel(id: string): Promise<NotificationChannelSummary> {
  const response = await apiClient.get<NotificationChannelSummary>(
    `/notifications/channels/${id}`
  );
  return response.data;
}

export async function createChannel(
  payload: CreateNotificationChannelInput
): Promise<NotificationChannelSummary> {
  const response = await apiClient.post<NotificationChannelSummary>(
    '/notifications/channels',
    payload
  );
  return response.data;
}

export async function updateChannel(
  id: string,
  payload: UpdateNotificationChannelInput
): Promise<NotificationChannelSummary> {
  const response = await apiClient.patch<NotificationChannelSummary>(
    `/notifications/channels/${id}`,
    payload
  );
  return response.data;
}

export async function deleteChannel(id: string): Promise<void> {
  await apiClient.delete<void>(`/notifications/channels/${id}`);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type ListTasksParams = {
  scopeId?: string;
  channelId?: string;
  status?: NotificationTaskStatus;
  eventId?: string;
};

export async function listNotificationTasks(
  params?: ListTasksParams
): Promise<NotificationTaskSummary[]> {
  const response = await apiClient.get<NotificationTaskSummary[]>(
    '/notifications/tasks',
    { params }
  );
  return response.data;
}

export async function retryNotificationTask(
  id: string
): Promise<NotificationTaskSummary> {
  const response = await apiClient.post<NotificationTaskSummary>(
    `/notifications/tasks/${id}/retry`
  );
  return response.data;
}
