import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { toApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { deleteProject, updateProject } from '@/api/projects';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';
import { EditorToolbar } from '@/components/app/EditorToolbar';
import { EmptyState } from '@/components/app/EmptyState';
import { FormField } from '@/components/app/FormField';
import { SurfaceCard } from '@/components/app/SurfaceCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  buildProjectFormValues,
  buildUpdateProjectInput,
  projectConfigFormSchema,
  type ProjectConfigFormValues
} from '@/pages/projects/project-form.utils';
import { ProjectSectionHeader } from '@/pages/projects/ProjectSectionHeader';
import { useProjectPageData } from '@/pages/projects/use-project-page-data';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { projectConfig } from '@/types/projects';

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-10 w-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />
    </div>
  );
}

function isWorkspacePathError(message: string) {
  return (
    message.includes('workspacePath') ||
    message.includes('目录') ||
    message.includes('absolute path')
  );
}

export function ProjectConfigPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {
    id,
    project,
    projects,
    isLoading,
    isNotFound,
    goToProjects,
    goToProjectTab
  } = useProjectPageData();

  const form = useForm<ProjectConfigFormValues>({
    resolver: zodResolver(projectConfigFormSchema),
    defaultValues: buildProjectFormValues()
  });

  const initialValues = useMemo(
    () => buildProjectFormValues(project ?? undefined),
    [project]
  );

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const updateMutation = useMutation({
    mutationFn: (values: ProjectConfigFormValues) =>
      updateProject(id!, buildUpdateProjectInput(values)),
    onSuccess: async (savedProject) => {
      setSubmitError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.all
        }),
        queryClient.setQueryData(
          queryKeys.projects.detail(savedProject.id),
          savedProject
        )
      ]);
      setCurrentProject(savedProject.id);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: async () => {
      setCurrentProject(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projects.all
      });
      void navigate(projectConfig.path);
    }
  });

  const handleSave = form.handleSubmit(async (values) => {
    setSubmitError(null);
    form.clearErrors();

    try {
      await updateMutation.mutateAsync(values);
    } catch (error) {
      const apiError = toApiRequestError(error);

      if (apiError.code === 400 && isWorkspacePathError(apiError.message)) {
        form.setError('workspacePath', { message: apiError.message });
        setSubmitError(apiError.message);
        return;
      }

      setSubmitError(apiError.message);
      handleError(error);
    }
  });

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
        activeTab="config"
        onProjectChange={(nextId) => goToProjectTab(nextId, 'config')}
        onTabChange={(tab) => goToProjectTab(id, tab)}
      />

      <div className="space-y-4">
        <EditorToolbar
          title="Project 配置"
          onSave={() => void handleSave()}
          showBack={false}
          saveDisabled={updateMutation.isPending}
        />

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>保存失败</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <SurfaceCard>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                label="Name"
                htmlFor="project-config-name"
                error={form.formState.errors.name?.message}
              >
                <Input id="project-config-name" {...form.register('name')} />
              </FormField>

              <FormField
                label="Workspace Path"
                htmlFor="project-config-workspace-path"
                description="更新时同样必须是已存在的绝对目录。"
                error={form.formState.errors.workspacePath?.message}
              >
                <Input
                  id="project-config-workspace-path"
                  {...form.register('workspacePath')}
                />
              </FormField>

              <FormField
                label="Git URL"
                htmlFor="project-config-git-url"
                description="创建后不可修改。"
                error={form.formState.errors.gitUrl?.message}
                className="lg:col-span-2"
              >
                <Input
                  id="project-config-git-url"
                  readOnly
                  disabled
                  {...form.register('gitUrl')}
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="project-config-description"
                error={form.formState.errors.description?.message}
                className="lg:col-span-2"
              >
                <Textarea
                  id="project-config-description"
                  rows={5}
                  {...form.register('description')}
                />
              </FormField>
            </div>
          </SurfaceCard>

          <SurfaceCard className="border-destructive/20 bg-destructive/5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-foreground">删除当前 Project</p>
                <p className="text-sm text-muted-foreground">
                  删除后不可恢复。当前阶段没有关联资源检查。
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
              >
                删除 Project
              </Button>
            </div>
          </SurfaceCard>
        </form>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={`删除 ${project.name}？`}
        description="删除后不可恢复。"
        confirmLabel="删除"
        pending={deleteMutation.isPending}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          void deleteMutation.mutateAsync().catch(handleError);
        }}
      />
    </div>
  );
}
