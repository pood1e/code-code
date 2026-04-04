import { Workflow } from 'lucide-react';
import { useParams } from 'react-router-dom';

export function ProjectPipelinesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 text-center">
      <div className="rounded-full bg-muted p-6">
        <Workflow className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-semibold tracking-tight">Pipeline 功能开发中</h2>
        <p className="text-muted-foreground text-sm">
          多智能体 TDD 流水线即将上线。Project ID：{projectId}
        </p>
      </div>
    </div>
  );
}
