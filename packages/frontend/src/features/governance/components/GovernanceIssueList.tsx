import type { GovernanceIssueSummary } from '@agent-workbench/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type GovernanceIssueListProps = {
  issues: GovernanceIssueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function GovernanceIssueList({
  issues,
  selectedId,
  onSelect
}: GovernanceIssueListProps) {
  return (
    <div className="flex flex-col">
      {issues.map((issue) => {
        const isSelected = issue.id === selectedId;

        return (
          <button
            key={issue.id}
            type="button"
            onClick={() => onSelect(issue.id)}
            className={cn(
              'flex flex-col gap-2 border-b px-4 py-3 text-left transition-colors hover:bg-muted/35',
              isSelected && 'bg-accent/60'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {issue.title}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {issue.impactSummary}
                </p>
              </div>
              <Badge variant="outline">{issue.status}</Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {issue.latestAssessment ? (
                <>
                  <Badge variant="secondary">
                    {issue.latestAssessment.priority}
                  </Badge>
                  <Badge variant="outline">
                    {issue.latestAssessment.severity}
                  </Badge>
                </>
              ) : null}
              <Badge variant="outline">{issue.kind}</Badge>
              {issue.latestPlanningAttempt ? (
                <Badge variant="secondary">
                  planning:{issue.latestPlanningAttempt.status}
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
