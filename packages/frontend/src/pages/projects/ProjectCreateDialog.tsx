import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { toApiRequestError } from '@/api/client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { createProject } from '@/api/projects';
import { FormField } from '@/components/app/FormField';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  buildCreateProjectInput,
  buildProjectFormValues,
  createProjectFormSchema,
  type CreateProjectFormValues
} from '@/pages/projects/project-form.utils';
import { ProjectWorkspaceTopologyNote } from '@/pages/projects/ProjectWorkspaceTopologyNote';
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { buildProjectConfigPath } from '@/types/projects';

function isWorkspaceRootPathError(message: string) {
  return (
    message.includes('workspaceRootPath') ||
    message.includes('目录') ||
    message.includes('absolute path')
  );
}

function isRepoGitUrlError(message: string) {
  return (
    message.includes('repoGitUrl') || message.includes('如 git@github.com')
  );
}

function isDocGitUrlError(message: string) {
  return (
    message.includes('docGitUrl') ||
    message.includes('文档') ||
    message.includes('SSH Git 地址')
  );
}

type ProjectCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectCreateDialog({
  open,
  onOpenChange
}: ProjectCreateDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useErrorMessage();
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const [createError, setCreateError] = useState<string | null>(null);

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: buildProjectFormValues()
  });

  const resetDialogState = () => {
    setCreateError(null);
    form.reset(buildProjectFormValues());
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetDialogState();
    }
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async (createdProject) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.all
        }),
        queryClient.setQueryData(
          queryKeys.projects.detail(createdProject.id),
          createdProject
        )
      ]);

      setCurrentProject(createdProject.id);
      handleDialogOpenChange(false);
      void navigate(buildProjectConfigPath(createdProject.id));
    }
  });

  const handleCreate = form.handleSubmit(async (values) => {
    setCreateError(null);
    form.clearErrors();

    try {
      await createMutation.mutateAsync(buildCreateProjectInput(values));
    } catch (error) {
      const apiError = toApiRequestError(error);

      if (apiError.code === 400) {
        if (isWorkspaceRootPathError(apiError.message)) {
          form.setError('workspaceRootPath', { message: apiError.message });
        }

        if (isRepoGitUrlError(apiError.message)) {
          form.setError('repoGitUrl', { message: apiError.message });
        }

        if (isDocGitUrlError(apiError.message)) {
          form.setError('docGitUrl', { message: apiError.message });
        }

        setCreateError(apiError.message);
        return;
      }

      setCreateError(apiError.message);
      handleError(error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建 Project</DialogTitle>
          <DialogDescription>
            `Workspace Root` 是 session / flow 的工作根目录；`Repo (Git)` 和 `Doc (Git)` 是远端来源。
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <ProjectWorkspaceTopologyNote
            workspaceRootPath={form.watch('workspaceRootPath')}
            repoGitUrl={form.watch('repoGitUrl')}
            docGitUrl={form.watch('docGitUrl')}
          />

          {createError ? (
            <Alert variant="destructive">
              <AlertTitle>创建失败</AlertTitle>
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          ) : null}

          <FormField
            label="Name"
            htmlFor="project-name"
            error={form.formState.errors.name?.message}
          >
            <Input id="project-name" autoFocus {...form.register('name')} />
          </FormField>

          <FormField
            label="Description"
            htmlFor="project-description"
            error={form.formState.errors.description?.message}
          >
            <Textarea
              id="project-description"
              rows={4}
              {...form.register('description')}
            />
          </FormField>

          <FormField
            label="Repo (Git)"
            htmlFor="project-git-url"
            description="只接受 SSH Git 地址，例如 git@github.com:user/repo.git"
            error={form.formState.errors.repoGitUrl?.message}
          >
            <Input id="project-git-url" {...form.register('repoGitUrl')} />
          </FormField>

          <FormField
            label="Workspace Root"
            htmlFor="project-workspace-root-path"
            description="会话与流程都会在这个根目录下创建各自的工作目录。"
            error={form.formState.errors.workspaceRootPath?.message}
          >
            <Input
              id="project-workspace-root-path"
              {...form.register('workspaceRootPath')}
            />
          </FormField>

          <FormField
            label="Doc (Git)"
            htmlFor="project-doc-source"
            description="可选，仅支持 SSH Git 地址。Session 会按需拉取到 docs 目录。"
            error={form.formState.errors.docGitUrl?.message}
          >
            <Input id="project-doc-source" {...form.register('docGitUrl')} />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
