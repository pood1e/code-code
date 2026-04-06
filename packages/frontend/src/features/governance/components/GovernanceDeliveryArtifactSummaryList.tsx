import type { DeliveryArtifact } from '@agent-workbench/shared';

import { EmptyState } from '@/components/app/EmptyState';
import { Badge } from '@/components/ui/badge';

type GovernanceDeliveryArtifactSummaryListProps = {
  artifacts: DeliveryArtifact[];
  onSelectIssue: (issueId: string) => void;
};

export function GovernanceDeliveryArtifactSummaryList({
  artifacts,
  onSelectIssue
}: GovernanceDeliveryArtifactSummaryListProps) {
  if (artifacts.length === 0) {
    return (
      <EmptyState
        size="compact"
        title="暂无 Delivery Artifact"
        description="当前 scope 还没有交付审批单。"
      />
    );
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => {
        const primaryIssueId = artifact.linkedIssueIds[0] ?? null;
        return (
          <button
            key={artifact.id}
            type="button"
            className="w-full rounded-lg border border-border/60 p-3 text-left transition hover:bg-muted/30"
            onClick={() => {
              if (primaryIssueId) {
                onSelectIssue(primaryIssueId);
              }
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {artifact.title}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  units: {artifact.linkedChangeUnitIds.length} · results:{' '}
                  {artifact.linkedVerificationResultIds.length}
                </p>
              </div>
              <Badge variant="outline">{artifact.status}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
