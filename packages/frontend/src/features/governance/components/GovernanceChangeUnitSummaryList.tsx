import type { ChangeUnit } from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { Badge } from '@/components/ui/badge';

type GovernanceChangeUnitSummaryListProps = {
  changeUnits: ChangeUnit[];
  onSelectIssue: (issueId: string) => void;
};

export function GovernanceChangeUnitSummaryList({
  changeUnits,
  onSelectIssue
}: GovernanceChangeUnitSummaryListProps) {
  if (changeUnits.length === 0) {
    return (
      <EmptyState
        size="compact"
        title="暂无 Change Unit"
        description="当前 scope 还没有可见的变更单元。"
      />
    );
  }

  return (
    <div className="space-y-2">
      {changeUnits.map((changeUnit) => (
        <button
          key={changeUnit.id}
          type="button"
          className="w-full rounded-lg border border-border/60 p-3 text-left transition hover:bg-muted/30"
          onClick={() => onSelectIssue(changeUnit.issueId)}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {changeUnit.title}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                mode: {changeUnit.executionMode}
              </p>
            </div>
            <Badge variant="outline">{changeUnit.status}</Badge>
          </div>
          {changeUnit.latestExecutionAttempt ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              exec #{changeUnit.latestExecutionAttempt.attemptNo} ·{' '}
              {changeUnit.latestExecutionAttempt.status}
            </p>
          ) : null}
          {changeUnit.latestVerificationResult ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              verification: {changeUnit.latestVerificationResult.status}
            </p>
          ) : null}
        </button>
      ))}
    </div>
  );
}
