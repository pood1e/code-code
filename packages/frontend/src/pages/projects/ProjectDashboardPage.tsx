import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { projectConfig } from '@/types/projects';

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}

export function ProjectDashboardPage() {
  const navigate = useNavigate();
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  if (isLoading) {
    return <LoadingState />;
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
    <div className="space-y-4">
      <ProjectSectionHeader
        projects={projects}
        currentProjectId={id}
        activeTab="dashboard"
        onProjectChange={(nextId) => goToProjectTab(nextId, 'dashboard')}
        onTabChange={(tab) => goToProjectTab(id, tab)}
      />

      <SurfaceCard className="py-10">
        <EmptyState
          title="Dashboard 敬请期待"
          description="第一阶段只实现 Project 配置管理，Dashboard 暂不提供实际内容。"
          action={
            <Button
              onClick={() =>
                void navigate(`${projectConfig.path}/${id}/config`)
              }
            >
              前往配置页
            </Button>
          }
        />
      </SurfaceCard>
    </div>
  );
}
