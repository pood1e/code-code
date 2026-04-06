import {
  createProjectInputSchema,
  sshGitUrlSchema,
  updateProjectInputSchema,
  type CreateProjectInput,
  type Project,
  type UpdateProjectInput
} from '@agent-workbench/shared';
import { z } from 'zod';

import { normalizeDescription, normalizeOptionalText } from '@/utils/format-display';

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
const workspaceRootPathSchema = z.string().trim().min(1, '工作根目录不能为空');
const projectDocGitUrlFormSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || sshGitUrlSchema.safeParse(value).success,
    '请输入合法的 SSH Git 地址'
  )
  .optional();

export const createProjectFormSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  repoGitUrl: sshGitUrlSchema,
  workspaceRootPath: workspaceRootPathSchema,
  docGitUrl: projectDocGitUrlFormSchema
});

export const projectConfigFormSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  repoGitUrl: sshGitUrlSchema,
  workspaceRootPath: workspaceRootPathSchema,
  docGitUrl: projectDocGitUrlFormSchema
});

export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;
export type ProjectConfigFormValues = z.infer<typeof projectConfigFormSchema>;

export function buildProjectFormValues(
  project?: Project
): ProjectConfigFormValues {
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    repoGitUrl: project?.repoGitUrl ?? '',
    workspaceRootPath: project?.workspaceRootPath ?? '',
    docGitUrl: project?.docGitUrl ?? ''
  };
}

export function buildCreateProjectInput(
  values: CreateProjectFormValues
): CreateProjectInput {
  return createProjectInputSchema.parse({
    name: values.name,
    description: normalizeDescription(values.description),
    repoGitUrl: values.repoGitUrl,
    workspaceRootPath: values.workspaceRootPath,
    docGitUrl: normalizeOptionalText(values.docGitUrl)
  });
}

export function buildUpdateProjectInput(
  values: ProjectConfigFormValues
): UpdateProjectInput {
  return updateProjectInputSchema.parse({
    name: values.name,
    description: normalizeDescription(values.description),
    repoGitUrl: values.repoGitUrl,
    workspaceRootPath: values.workspaceRootPath,
    docGitUrl: normalizeOptionalText(values.docGitUrl)
  });
}
