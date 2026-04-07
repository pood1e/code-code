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
    <div className="divide-y divide-border/60">
      {issues.map((issue) => {
        const isSelected = issue.id === selectedId;

        return (
          <button
            key={issue.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(issue.id)}
            className={cn(
              'group relative flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/20',
              isSelected &&
                'bg-primary/10'
            )}
          >
            <div
              className={cn(
                'absolute inset-y-2 left-0 w-0.5 rounded-full bg-transparent transition-colors',
                isSelected && 'bg-primary'
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {issue.latestAssessment ? (
                  <Badge variant="secondary" className="bg-muted/70 text-foreground">
                    {issue.latestAssessment.priority}
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={cn(
                    'border-border/70 bg-background/70',
                    isSelected && 'border-primary/25 bg-primary/10 text-primary'
                  )}
                >
                  {issue.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {issue.title}
              </p>
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                {issue.impactSummary || issue.statement}
              </p>
            </div>

            <div className="shrink-0 pt-1 text-right text-[11px] text-muted-foreground">
              {issue.affectedTargets[0]?.ref ? (
                <p className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground/90">
                  {issue.affectedTargets[0].ref}
                </p>
              ) : null}
              <p className="mt-1">{issue.kind}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
