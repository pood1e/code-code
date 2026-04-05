import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  XCircle,
  Pause,
  Ban
} from 'lucide-react';
import { useState } from 'react';

import { PipelineStatus, type PipelineDetail } from '@agent-workbench/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { listAgentRunners } from '@/api/agent-runners';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/query/query-keys';

import { ArtifactList } from './ArtifactList';
import { HumanReviewPanel } from './HumanReviewPanel';
import { PipelineStageTimeline } from './PipelineStageTimeline';
import {
  useCancelPipelineMutation,
  useStartPipelineMutation
} from '../hooks/use-pipeline-mutations';
import { usePipelineEventStream } from '../hooks/use-pipeline-event-stream';

type Props = {
  pipelineId: string;
  scopeId: string;
  pipeline: PipelineDetail | undefined;
  isLoading: boolean;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: {
    label: '草稿',
    icon: <Clock className="h-3.5 w-3.5" />,
    variant: 'outline'
  },
  pending: {
    label: '排队中',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    variant: 'secondary'
  },
  running: {
    label: '执行中',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    variant: 'default'
  },
  paused: {
    label: '等待审核',
    icon: <Pause className="h-3.5 w-3.5" />,
    variant: 'secondary'
  },
  completed: {
    label: '已完成',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    variant: 'default'
  },
  failed: {
    label: '失败',
    icon: <XCircle className="h-3.5 w-3.5" />,
    variant: 'destructive'
  },
  cancelled: {
    label: '已取消',
    icon: <Ban className="h-3.5 w-3.5" />,
    variant: 'outline'
  }
};

export function PipelineDetail({ pipelineId, scopeId, pipeline, isLoading }: Props) {
  const [selectedRunnerId, setSelectedRunnerId] = useState<string>('');

  // Subscribe to live events — auto-invalidates cache on state transitions
  usePipelineEventStream(pipelineId, scopeId);

  const runnersQuery = useQuery({
    queryKey: queryKeys.agentRunners.list(),
    queryFn: () => listAgentRunners()
  });

  const startMutation = useStartPipelineMutation(pipelineId, scopeId);
  const cancelMutation = useCancelPipelineMutation(pipelineId, scopeId);

  function handleStart() {
    const runnerId = selectedRunnerId || (runnersQuery.data?.[0]?.id ?? '');
    if (!runnerId) return;
    startMutation.mutate(runnerId);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        选择左侧 Pipeline 查看详情
      </div>
    );
  }

  const status = pipeline.status;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['draft'];
  const isPaused = status === PipelineStatus.Paused;
  const isDraft = status === PipelineStatus.Draft;
  const isActive =
    status === PipelineStatus.Pending || status === PipelineStatus.Running;
  const isTerminal =
    status === PipelineStatus.Completed ||
    status === PipelineStatus.Cancelled ||
    status === PipelineStatus.Failed;
  const runners = runnersQuery.data ?? [];
  const runnerName =
    pipeline.runnerId
      ? runners.find((runner) => runner.id === pipeline.runnerId)?.name ??
        pipeline.runnerId
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4 pb-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold truncate">{pipeline.name}</h2>
          {runnerName && (
            <p className="mt-1 text-xs text-muted-foreground">Runner: {runnerName}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant={statusCfg.variant}
              className={`flex items-center gap-1 text-xs ${
                status === PipelineStatus.Completed
                  ? 'bg-green-600 text-white'
                  : status === PipelineStatus.Running ||
                      status === PipelineStatus.Pending
                    ? 'bg-blue-600 text-white'
                    : ''
              }`}
            >
              {statusCfg.icon}
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDraft && (
            <>
              {runners.length > 1 && (
                <select
                  id={`runner-select-${pipelineId}`}
                  value={selectedRunnerId}
                  onChange={(e) => setSelectedRunnerId(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="">默认 Runner</option>
                  {runners.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <Button
                id={`start-pipeline-btn-${pipelineId}`}
                size="sm"
                onClick={handleStart}
                disabled={startMutation.isPending || runners.length === 0}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1" />
                )}
                启动
              </Button>
            </>
          )}

          {(isActive || isPaused) && (
            <Button
              id={`cancel-pipeline-btn-${pipelineId}`}
              size="sm"
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Ban className="h-3.5 w-3.5 mr-1" />
              )}
              取消
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Human review */}
        {isPaused && pipeline.humanReview ? (
          <HumanReviewPanel
            pipelineId={pipelineId}
            scopeId={scopeId}
            review={pipeline.humanReview}
          />
        ) : null}

        {/* Stage timeline */}
        {pipeline.stages.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              执行阶段
            </h3>
            <PipelineStageTimeline stages={pipeline.stages} />
          </div>
        )}

        {/* Artifacts */}
        {!isTerminal || pipeline.artifacts.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              产出物
            </h3>
            <ArtifactList pipelineId={pipelineId} artifacts={pipeline.artifacts} />
          </div>
        ) : null}

        {/* Empty state for draft */}
        {isDraft && pipeline.stages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
            <p>点击「启动」开始执行计划阶段</p>
            <p className="text-xs">
              将自动运行 Breakdown → Evaluation → Spec → Estimate，然后等待您的审核
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
