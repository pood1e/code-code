import type { Finding } from '@agent-workbench/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type GovernanceFindingListProps = {
  findings: Finding[];
  retryingFindingId?: string | null;
  onRetry: (findingId: string) => void;
};

export function GovernanceFindingList({
  findings,
  retryingFindingId,
  onRetry
}: GovernanceFindingListProps) {
  return (
    <div className="flex flex-col">
      {findings.map((finding) => (
        <div
          key={finding.id}
          className="space-y-2 border-b px-4 py-3 text-left last:border-b-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {finding.title}
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {finding.summary}
              </p>
            </div>
            <Badge variant="outline">{finding.status}</Badge>
          </div>

          {finding.latestTriageAttempt ? (
            <div className="space-y-1">
              <Badge variant="secondary">
                triage:{finding.latestTriageAttempt.status}
              </Badge>
              {finding.latestTriageAttempt.failureMessage ? (
                <p className="text-xs text-muted-foreground">
                  {finding.latestTriageAttempt.failureMessage}
                </p>
              ) : null}
              {finding.latestTriageAttempt.sessionId ? (
                <p className="font-mono text-[11px] text-muted-foreground">
                  session: {finding.latestTriageAttempt.sessionId}
                </p>
              ) : null}
              {finding.latestTriageAttempt.status === 'needs_human_review' ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={retryingFindingId === finding.id}
                    onClick={() => onRetry(finding.id)}
                  >
                    Retry Triage
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">triage: pending</p>
          )}
        </div>
      ))}
    </div>
  );
}
