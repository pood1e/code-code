import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  XCircle,
  Eye
} from 'lucide-react';

import type { PipelineStageSummary } from '@agent-workbench/shared';

type Props = {
  stages: PipelineStageSummary[];
};

const STAGE_LABEL: Record<string, string> = {
  breakdown: 'Breakdown',
  evaluation: 'Evaluation',
  spec: 'Spec',
  estimate: 'Estimate',
  human_review: 'Human Review'
};

function StageIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'awaiting_review':
      return <Eye className="h-4 w-4 text-amber-500" />;
    case 'skipped':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  }
}

function stageStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    skipped: '已跳过',
    awaiting_review: '等待审核'
  };
  return map[status] ?? status;
}

export function PipelineStageTimeline({ stages }: Props) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((stage, index) => (
        <div key={stage.id} className="flex items-start gap-3">
          {/* Connector line + icon */}
          <div className="flex flex-col items-center">
            <div className="mt-1 flex-shrink-0">
              <StageIcon status={stage.status} />
            </div>
            {index < sorted.length - 1 && (
              <div className="mt-1 w-px flex-1 bg-border min-h-[20px]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {STAGE_LABEL[stage.stageType] ?? stage.name}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  stage.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : stage.status === 'running'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : stage.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : stage.status === 'awaiting_review'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                }`}
              >
                {stageStatusLabel(stage.status)}
              </span>
            </div>
            {stage.status === 'failed' && stage.retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                已重试 {stage.retryCount} 次
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
