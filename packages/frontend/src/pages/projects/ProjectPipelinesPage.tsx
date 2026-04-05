import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { ArtifactList } from '@/features/pipelines/components/ArtifactList';
import { HumanReviewPanel } from '@/features/pipelines/components/HumanReviewPanel';
import { PipelineCreateDialog } from '@/features/pipelines/components/PipelineCreateDialog';
import { PipelineDetail } from '@/features/pipelines/components/PipelineDetail';
import { PipelineList } from '@/features/pipelines/components/PipelineList';
import { usePipelineDetail, usePipelineList } from '@/features/pipelines/hooks/use-pipeline-queries';

// Suppress unused-import warnings — these are re-exported for the lazy split boundary
void ArtifactList;
void HumanReviewPanel;

export function ProjectPipelinesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const listQuery = usePipelineList(projectId);
  const detailQuery = usePipelineDetail(selectedPipelineId);

  const pipelines = listQuery.data ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Pipelines</h2>
          {projectId && (
            <PipelineCreateDialog
              scopeId={projectId}
              onCreated={(id) => setSelectedPipelineId(id)}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PipelineList
              pipelines={pipelines}
              selectedId={selectedPipelineId}
              onSelect={(id) => setSelectedPipelineId(id)}
            />
          )}
        </div>
      </div>

      <Separator orientation="vertical" />

      {/* ── Detail panel ── */}
      <div className="flex-1 overflow-hidden">
        {selectedPipelineId ? (
          <PipelineDetail
            pipelineId={selectedPipelineId}
            scopeId={projectId ?? ''}
            pipeline={detailQuery.data}
            isLoading={detailQuery.isLoading}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {pipelines.length === 0
              ? '创建第一个 Pipeline 开始 TDD 工作流'
              : '从左侧选择一个 Pipeline'}
          </div>
        )}
      </div>
    </div>
  );
}
