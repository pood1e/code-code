import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/app/EmptyState';
import { PageLoadingSkeleton } from '@/components/app/PageLoadingSkeleton';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { buildProjectConfigPath } from '@/types/projects';

export function ProjectDashboardPage() {
  const navigate = useNavigate();
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects
  } = useProjectPageData();

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (isNotFound) {
    return (
      <EmptyState
        title="Project 不存在"
        description="当前 Project 不存在或已被删除。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  if (!id || !project || projects.length === 0) {
    return (
      <EmptyState
        title="暂无可用 Project"
        description="请先回到 Project 列表创建或选择一个 Project。"
        action={<Button onClick={goToProjects}>返回 Projects</Button>}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <SurfaceCard className="py-10">
            <EmptyState
              title="概览敬请期待"
              description="第一阶段先实现 Project 配置和会话管理，概览页暂不提供实际内容。"
              action={
                <Button
                  onClick={() => void navigate(buildProjectConfigPath(id))}
                >
                  前往配置页
                </Button>
              }
            />
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
