export type Project = {
  id: string;
  name: string;
  description: string | null;
  gitUrl: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  gitUrl: string;
  workspacePath: string;
};

export type UpdateProjectInput = {
  name: string;
  description?: string | null;
  workspacePath: string;
};
