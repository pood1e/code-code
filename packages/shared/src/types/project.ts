export type Project = {
  id: string;
  name: string;
  description: string | null;
  gitUrl: string;
  workspacePath: string;
  docSource?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  gitUrl: string;
  workspacePath: string;
  docSource?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  workspacePath?: string;
  docSource?: string | null;
};
