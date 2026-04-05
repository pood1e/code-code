import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateNotificationMessageInput } from '@agent-workbench/shared';

import { sendNotificationMessage } from '@/api/notifications';
import { queryKeys } from '@/query/query-keys';

export function useSendNotificationMessage(scopeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateNotificationMessageInput) =>
      sendNotificationMessage(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: scopeId
          ? ['notifications', 'tasks', 'list', scopeId]
          : queryKeys.notifications.tasks.all
      });
    }
  });
}
