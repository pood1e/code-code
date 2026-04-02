import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useErrorMessage } from '@/hooks/use-error-message';
import { listProjects } from '@/api/projects';
import { EmptyState } from '@/components/app/EmptyState';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Button } from '@/components/ui/button';
import { ProjectCreateDialog } from '@/pages/projects/ProjectCreateDialog';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { projectConfig } from '@/types/projects';

export function ProjectListPage() {
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => listProjects()
  });

  useEffect(() => {
    if (projectsQuery.error) {
      handleError(projectsQuery.error);
    }
  }, [handleError, projectsQuery.error]);

  const openProject = useCallback(
    (projectId: string) => {
      setCurrentProject(projectId);
      void navigate(`${projectConfig.path}/${projectId}/config`);
    },
    [navigate, setCurrentProject]
  );

  const projects = projectsQuery.data;

  useEffect(() => {
    if (!currentProjectId || !projects || projects.length === 0) {
      return;
    }

    const currentProject = projects.find(
      (project) => project.id === currentProjectId
    );

    if (currentProject) {
      void navigate(`${projectConfig.path}/${currentProject.id}/config`, {
        replace: true
      });
    }
  }, [currentProjectId, navigate, projects]);

  if (projectsQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <>
        <SurfaceCard className="mx-auto max-w-3xl py-10">
          <EmptyState
            title="暂无 Project"
            description="先创建一个 Project，之后再进入配置页或 Dashboard。"
            action={
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus data-icon="inline-start" />
                新建 Project
              </Button>
            }
          />
        </SurfaceCard>
        <ProjectCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              选择一个 Project
            </h1>
            <p className="text-sm text-muted-foreground">
              进入选中的 Project 后，再在顶部切换“配置”与“Dashboard”。
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            新建 Project
          </Button>
        </div>

        <div className="space-y-3">
          {projects.map((project) => {
            const isCurrent = project.id === currentProjectId;

            return (
              <SurfaceCard
                key={project.id}
                className="p-0 transition-colors hover:border-foreground/15"
              >
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {project.name}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground">
                          当前
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {project.description?.trim() || '暂无描述'}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-1 text-sm text-muted-foreground sm:max-w-[24rem] sm:text-right">
                    <p className="truncate">{project.workspacePath}</p>
                    <p className="truncate">{project.gitUrl}</p>
                  </div>
                </button>
              </SurfaceCard>
            );
          })}
        </div>
      </div>

      <ProjectCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
