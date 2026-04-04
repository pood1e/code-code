import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationTaskStatus } from '@agent-workbench/shared';

import { listNotificationTasks, retryNotificationTask } from '../../../api/notifications';
import { queryKeys } from '../../../query/query-keys';

export function useNotificationTasks(scopeId?: string, channelId?: string) {
  return useQuery({
    queryKey: queryKeys.notifications.tasks.list(scopeId, channelId),
    queryFn: () => listNotificationTasks({ scopeId, channelId }),
    enabled: scopeId !== undefined,
    refetchInterval: 10_000 // 10s auto-refresh for task monitoring
  });
}

export function useRetryTask(scopeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => retryNotificationTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.tasks.list(scopeId)
      });
    }
  });
}

// ─── Type re-export for page convenience ──────────────────────────────────────

export type { NotificationTaskStatus };
