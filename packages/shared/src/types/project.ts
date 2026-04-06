export type Project = {
  id: string;
  name: string;
  description: string | null;
  repoGitUrl: string;
  workspaceRootPath: string;
  docGitUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  repoGitUrl: string;
  workspaceRootPath: string;
  docGitUrl?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  repoGitUrl?: string;
  workspaceRootPath?: string;
  docGitUrl?: string | null;
};
