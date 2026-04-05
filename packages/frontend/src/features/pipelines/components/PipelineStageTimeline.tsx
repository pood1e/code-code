import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Loader2,
  XCircle
} from 'lucide-react';

import {
  PipelineStageStatus,
  StageExecutionAttemptStatus,
  type PipelineStageSummary
} from '@agent-workbench/shared';

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

function StageIcon({ status }: { status: PipelineStageStatus }) {
  switch (status) {
    case PipelineStageStatus.Completed:
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case PipelineStageStatus.Running:
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case PipelineStageStatus.Failed:
      return <XCircle className="h-4 w-4 text-red-500" />;
    case PipelineStageStatus.Cancelled:
      return <Ban className="h-4 w-4 text-slate-500" />;
    case PipelineStageStatus.AwaitingReview:
      return <Eye className="h-4 w-4 text-amber-500" />;
    case PipelineStageStatus.Skipped:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  }
}

function stageStatusLabel(status: PipelineStageStatus) {
  const map: Record<PipelineStageStatus, string> = {
    [PipelineStageStatus.Pending]: '等待中',
    [PipelineStageStatus.Running]: '执行中',
    [PipelineStageStatus.Completed]: '已完成',
    [PipelineStageStatus.Failed]: '失败',
    [PipelineStageStatus.Cancelled]: '已取消',
    [PipelineStageStatus.Skipped]: '已跳过',
    [PipelineStageStatus.AwaitingReview]: '等待审核'
  };
  return map[status];
}

function attemptStatusLabel(status: StageExecutionAttemptStatus) {
  const map: Record<StageExecutionAttemptStatus, string> = {
    [StageExecutionAttemptStatus.Pending]: '等待中',
    [StageExecutionAttemptStatus.Running]: '执行中',
    [StageExecutionAttemptStatus.WaitingRepair]: '等待修复',
    [StageExecutionAttemptStatus.Succeeded]: '成功',
    [StageExecutionAttemptStatus.Failed]: '失败',
    [StageExecutionAttemptStatus.NeedsHumanReview]: '等待人工处理',
    [StageExecutionAttemptStatus.ResolvedByHuman]: '人工处理完成',
    [StageExecutionAttemptStatus.Cancelled]: '已取消'
  };
  return map[status];
}

export function PipelineStageTimeline({ stages }: Props) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-0">
      {sorted.map((stage, index) => (
        <div key={stage.id} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-1 flex-shrink-0">
              <StageIcon status={stage.status} />
            </div>
            {index < sorted.length - 1 ? (
              <div className="mt-1 min-h-[20px] w-px flex-1 bg-border" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {STAGE_LABEL[stage.stageType] ?? stage.name}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                  stage.status === PipelineStageStatus.Completed
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : stage.status === PipelineStageStatus.Running
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : stage.status === PipelineStageStatus.Failed
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : stage.status === PipelineStageStatus.Cancelled
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300'
                          : stage.status === PipelineStageStatus.AwaitingReview
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                }`}
              >
                {stageStatusLabel(stage.status)}
              </span>
            </div>

            {stage.status === PipelineStageStatus.Failed && stage.retryCount > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                已重试 {stage.retryCount} 次
              </p>
            ) : null}

            {stage.attemptCount > 0 ? (
              <div className="mt-2 space-y-1 rounded-md border border-border/70 bg-muted/30 p-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Attempts: {stage.attemptCount}
                </p>
                {stage.attempts.map((attempt) => (
                  <div key={attempt.id} className="text-[11px] text-muted-foreground">
                    <p>
                      尝试 {attempt.attemptNo}: {attemptStatusLabel(attempt.status)}
                    </p>
                    {attempt.sessionId ? <p>Session: {attempt.sessionId}</p> : null}
                    {attempt.failureMessage ? (
                      <p>失败原因: {attempt.failureMessage}</p>
                    ) : null}
                  </div>
                ))}
                {stage.latestFailureReason ? (
                  <p className="text-[11px] text-muted-foreground">
                    最近失败: {stage.latestFailureReason}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
