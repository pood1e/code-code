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
const workspacePathSchema = z
  .string()
  .trim()
  .min(1, 'workspacePath is required');
const localAbsolutePathSchema = z
  .string()
  .trim()
  .regex(/^\//, '请输入合法的 SSH Git 地址或本地绝对路径');

export const sshGitUrlSchema = z
  .string()
  .trim()
  .regex(
    /^git@[\w.-]+:[\w./-]+\.git$/,
    '请输入合法的 SSH Git 地址，如 git@github.com:user/repo.git'
  );
export const projectDocSourceSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}, z.union([sshGitUrlSchema, localAbsolutePathSchema]).nullable().optional());

export const projectSchema = z.object({
  id: z.string(),
  name: projectNameSchema,
  description: z.string().nullable(),
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema,
  docSource: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const createProjectInputSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema,
  docSource: projectDocSourceSchema
});

export const updateProjectInputSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema,
    workspacePath: workspacePathSchema.optional(),
    docSource: projectDocSourceSchema
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.workspacePath !== undefined ||
      value.docSource !== undefined,
    {
      message: 'At least one project field must be provided'
    }
  );
