import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput
} from '@agent-workbench/shared';

import {
  createChannel,
  deleteChannel,
  listChannelTypes,
  listChannels,
  updateChannel
} from '../../../api/notifications';
import { queryKeys } from '../../../query/query-keys';

export function useChannelTypes() {
  return useQuery({
    queryKey: queryKeys.notifications.channelTypes(),
    queryFn: listChannelTypes,
    staleTime: 5 * 60 * 1000 // 5 minutes — rarely changes
  });
}

export function useNotificationChannels(scopeId?: string) {
  return useQuery({
    queryKey: queryKeys.notifications.channels.list(scopeId),
    queryFn: () => listChannels(scopeId),
    enabled: scopeId !== undefined
  });
}

export function useCreateChannel(scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateNotificationChannelInput) => createChannel(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels.list(scopeId)
      });
    }
  });
}

export function useUpdateChannel(id: string, scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateNotificationChannelInput) => updateChannel(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels.list(scopeId)
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels.detail(id)
      });
    }
  });
}

export function useDeleteChannel(id: string, scopeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteChannel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels.list(scopeId)
      });
    }
  });
}
