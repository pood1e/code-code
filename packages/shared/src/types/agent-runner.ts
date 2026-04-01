export type RunnerTypeCapabilities = {
  skill: boolean;
  rule: boolean;
  mcp: boolean;
};

export type RunnerTypeMeta = {
  id: string;
  name: string;
  capabilities: RunnerTypeCapabilities;
};

export type PlatformSessionConfig = {
  cwd: string;
  skills: string[];
  rules: string[];
  mcps: string[];
};

export type RunnerTypeResponse = RunnerTypeMeta & {
  runnerConfigSchema: object;
  runnerSessionConfigSchema: object;
  taskConfigSchema: object;
  runtimeConfigSchema: object;
};
