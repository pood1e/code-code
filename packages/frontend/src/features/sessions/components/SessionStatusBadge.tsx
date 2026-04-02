import { Badge } from '@/components/ui/badge';
import { getSessionStatusLabel } from '@/pages/projects/project-sessions.utils';
import { SessionStatus as SessionStatusEnum } from '@agent-workbench/shared';
import type { SessionStatus } from '@agent-workbench/shared';

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const variant =
    status === SessionStatusEnum.Ready
      ? 'default'
      : status === SessionStatusEnum.Running
        ? 'secondary'
        : status === SessionStatusEnum.Error
          ? 'destructive'
          : 'outline';

  return <Badge variant={variant}>{getSessionStatusLabel(status)}</Badge>;
}
