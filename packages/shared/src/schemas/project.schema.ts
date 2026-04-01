import { z } from 'zod';

const projectNameSchema = z.string().trim().min(1).max(100);
const projectDescriptionSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional();
const workspacePathSchema = z
  .string()
  .trim()
  .min(1, 'workspacePath is required');

export const sshGitUrlSchema = z
  .string()
  .trim()
  .regex(
    /^git@[\w.-]+:[\w./-]+\.git$/,
    '请输入合法的 SSH Git 地址，如 git@github.com:user/repo.git'
  );

export const projectSchema = z.object({
  id: z.string(),
  name: projectNameSchema,
  description: z.string().nullable(),
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const createProjectInputSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  gitUrl: sshGitUrlSchema,
  workspacePath: workspacePathSchema
});

export const updateProjectInputSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  workspacePath: workspacePathSchema
});
