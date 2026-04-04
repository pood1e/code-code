import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { ProjectSessionsPageContent } from './ProjectSessionsPageContent';
import { useProjectSessionsPageState } from './use-project-sessions-page-state';

export function ProjectSessionsPage() {
  const pageState = useProjectSessionsPageState();

  if (pageState.isLoading || pageState.sessionsQuery.isPending) {
    return <PageLoadingSkeleton variant="fullscreen" />;
  }

  if (pageState.isNotFound) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          title="Project 不存在"
          description="当前 Project 不存在或已被删除。"
          action={<Button onClick={pageState.goToProjects}>返回 Projects</Button>}
        />
      </div>
    );
  }

  if (
    !pageState.projectId ||
    !pageState.project ||
    pageState.projects.length === 0
  ) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          title="暂无可用 Project"
          description="请先回到 Project 列表创建或选择一个 Project。"
          action={<Button onClick={pageState.goToProjects}>返回 Projects</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <ProjectSessionsPageContent {...pageState} />
      </div>
    </div>
  );
}
