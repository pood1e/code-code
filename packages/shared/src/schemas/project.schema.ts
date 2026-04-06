import { z } from 'zod';

const projectNameSchema = z.string().trim().min(1).max(100);
const projectDescriptionSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}, z.string().trim().max(500).nullable().optional());
const workspaceRootPathSchema = z
  .string()
  .trim()
  .min(1, 'workspaceRootPath is required');

export const sshGitUrlSchema = z
  .string()
  .trim()
  .regex(
    /^git@[\w.-]+:[\w./-]+\.git$/,
    '请输入合法的 SSH Git 地址，如 git@github.com:user/repo.git'
  );
export const projectDocGitUrlSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}, sshGitUrlSchema.nullable().optional());

export const projectSchema = z.object({
  id: z.string(),
  name: projectNameSchema,
  description: z.string().nullable(),
  repoGitUrl: sshGitUrlSchema,
  workspaceRootPath: workspaceRootPathSchema,
  docGitUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const createProjectInputSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  repoGitUrl: sshGitUrlSchema,
  workspaceRootPath: workspaceRootPathSchema,
  docGitUrl: projectDocGitUrlSchema
});

export const updateProjectInputSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema,
    repoGitUrl: sshGitUrlSchema.optional(),
    workspaceRootPath: workspaceRootPathSchema.optional(),
    docGitUrl: projectDocGitUrlSchema
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.repoGitUrl !== undefined ||
      value.workspaceRootPath !== undefined ||
      value.docGitUrl !== undefined,
    {
      message: 'At least one project field must be provided'
    }
  );
