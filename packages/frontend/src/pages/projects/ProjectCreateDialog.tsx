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
import { queryKeys } from '@/query/query-keys';
import { useProjectStore } from '@/store/project-store';
import { buildProjectConfigPath } from '@/types/projects';

function isWorkspacePathError(message: string) {
  return (
    message.includes('workspacePath') ||
    message.includes('目录') ||
    message.includes('absolute path')
  );
}

function isGitUrlError(message: string) {
  return message.includes('gitUrl') || message.includes('如 git@github.com');
}

function isDocSourceError(message: string) {
  return (
    message.includes('docSource') ||
    message.includes('文档') ||
    message.includes('SSH Git 地址或本地绝对路径')
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
        if (isWorkspacePathError(apiError.message)) {
          form.setError('workspacePath', { message: apiError.message });
        }

        if (isGitUrlError(apiError.message)) {
          form.setError('gitUrl', { message: apiError.message });
        }

        if (isDocSourceError(apiError.message)) {
          form.setError('docSource', { message: apiError.message });
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
            创建后 `gitUrl` 将保持只读，`workspacePath` 必须是本机已存在的目录。
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
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
            label="Git URL"
            htmlFor="project-git-url"
            description="只接受 SSH Git 地址，例如 git@github.com:user/repo.git"
            error={form.formState.errors.gitUrl?.message}
          >
            <Input id="project-git-url" {...form.register('gitUrl')} />
          </FormField>

          <FormField
            label="Workspace Path"
            htmlFor="project-workspace-path"
            description="必须是当前机器上已存在的绝对目录。"
            error={form.formState.errors.workspacePath?.message}
          >
            <Input
              id="project-workspace-path"
              {...form.register('workspacePath')}
            />
          </FormField>

          <FormField
            label="文档地址"
            htmlFor="project-doc-source"
            description="可选。支持 SSH Git 地址或本地绝对路径目录。"
            error={form.formState.errors.docSource?.message}
          >
            <Input id="project-doc-source" {...form.register('docSource')} />
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
