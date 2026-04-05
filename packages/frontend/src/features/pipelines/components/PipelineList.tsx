import {
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  XCircle,
  Ban,
  Workflow
} from 'lucide-react';

import type { PipelineSummary } from '@agent-workbench/shared';

import { cn } from '@/lib/utils';

type Props = {
  pipelines: PipelineSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
    case 'running':
    case 'pending':
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin flex-shrink-0" />;
    case 'paused':
      return <Pause className="h-3 w-3 text-amber-500 flex-shrink-0" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
    case 'cancelled':
      return <Ban className="h-3 w-3 text-muted-foreground flex-shrink-0" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />;
  }
}

export function PipelineList({ pipelines, selectedId, onSelect }: Props) {
  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Workflow className="h-8 w-8 text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            还没有 Pipeline
          </p>
          <p className="text-xs text-muted-foreground/70">
            点击右上角「新建 Pipeline」开始
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-0.5 p-1">
      {pipelines.map((pipeline) => (
        <li key={pipeline.id}>
          <button
            id={`pipeline-item-${pipeline.id}`}
            type="button"
            className={cn(
              'w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-md text-sm transition-colors',
              'hover:bg-muted',
              selectedId === pipeline.id && 'bg-muted font-medium'
            )}
            onClick={() => onSelect(pipeline.id)}
          >
            <StatusDot status={pipeline.status} />
            <span className="flex-1 min-w-0 truncate">{pipeline.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
