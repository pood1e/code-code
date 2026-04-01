import {
  createProjectInputSchema,
  sshGitUrlSchema,
  updateProjectInputSchema,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput
} from '@agent-workbench/shared';
import { z } from 'zod';

import { normalizeDescription } from '@/utils/normalizers';

const projectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project 名称不能为空')
  .max(100, 'Project 名称不能超过 100 个字符');
const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Project 描述不能超过 500 个字符')
  .optional();
const workspacePathSchema = z.string().trim().min(1, 'Workspace 路径不能为空');

export const createProjectFormSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema
});

export const projectConfigFormSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema
});

export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;
export type ProjectConfigFormValues = z.infer<typeof projectConfigFormSchema>;

export function buildProjectFormValues(
  project?: Project
): ProjectConfigFormValues {
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    gitUrl: project?.gitUrl ?? '',
    workspacePath: project?.workspacePath ?? ''
  };
}

export function buildCreateProjectInput(
  values: CreateProjectFormValues
): CreateProjectInput {
  return createProjectInputSchema.parse({
    name: values.name,
    description: normalizeDescription(values.description),
    gitUrl: values.gitUrl,
    workspacePath: values.workspacePath
  });
}

export function buildUpdateProjectInput(
  values: ProjectConfigFormValues
): UpdateProjectInput {
  return updateProjectInputSchema.parse({
    name: values.name,
    description: normalizeDescription(values.description),
    workspacePath: values.workspacePath
  });
}
