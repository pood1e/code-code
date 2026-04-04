import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { useErrorMessage } from '@/hooks/use-error-message';
import { listProjects } from '@/api/projects';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import {
  buildProjectTabPath,
  projectConfig
} from '@/types/projects';
import type { ProjectTabKey } from '@/types/projects';

export function useProjectPageData() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleError = useErrorMessage();
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);

  useEffect(() => {
    setCurrentProject(id ?? null);
  }, [id, setCurrentProject]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => listProjects(),
    staleTime: 30_000
  });

  useEffect(() => {
    if (projectsQuery.error) {
      handleError(projectsQuery.error);
    }
  }, [handleError, projectsQuery.error]);

  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );
  const project = useMemo(
    () => projects.find((item) => item.id === id) ?? null,
    [id, projects]
  );
  const isLoading = projectsQuery.isPending;
  const isNotFound =
    Boolean(id) && !isLoading && projects.length > 0 && !project;

  const goToProjects = useCallback(() => {
    void navigate(projectConfig.path);
  }, [navigate]);

  const goToProjectTab = useCallback(
    (projectId: string, tab: ProjectTabKey) => {
      setCurrentProject(projectId);
      void navigate(buildProjectTabPath(projectId, tab));
    },
    [navigate, setCurrentProject]
  );

  return {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  };
}
